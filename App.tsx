import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  logOut
} from './utils/firebase';
import { clearSessions } from './utils/localStorage';
import { getCachedAudioBase64, setCachedAudioBase64, clearCachedAudio } from './utils/idbAudioCache';
import {
  backupToDrive,
  exportToDocs,
  downloadTranscriptLocally,
  listDriveSessions,
  restoreDriveSession,
  listCourses,
  createCourseWork
} from './utils/googleWorkspace';
import { Language, ConnectionStatus, VoiceOption, ConversationItem, ConversationSession, VisionResult } from './types';
import {
  SUPPORTED_LANGUAGES,
  MODEL_LIVE,
  MODEL_TRANSLATE,
  MODEL_VISION,
  MODEL_TTS,
  TRANSLATIONS,
  VOICE_OPTIONS,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  SETTINGS_KEY,
  UI_LANG_KEY,
  HISTORY_RENDER_STEP
} from './constants';
import { decodeAudioData, base64ToUint8Array, arrayBufferToBase64 } from './utils/audioUtils';
import { retry } from './utils/retry';
import Visualizer from './components/Visualizer';
import CameraView from './components/CameraView';
import AdminPanelModal from './components/AdminPanelModal';
import NotebookLMGuide from './components/NotebookLMGuide';
import LoginModal from './components/LoginModal';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import ClassroomModal from './components/ClassroomModal';
import VisionNotificationModal from './components/VisionNotificationModal';

import { useAuth } from './hooks/useAuth';
import { useConversationHistory } from './hooks/useConversationHistory';
import { useGeminiLive } from './hooks/useGeminiLive';
import { AppSettings, VisionNotification } from './types';

import {
  MicIcon,
  MicOffIcon,
  CameraIcon,
  ArrowRightIcon,
  SpeakerIcon,
  PlayAllIcon,
  GlobeIcon,
  ExportIcon,
  BellIcon,
  DocsIcon,
  DriveIcon,
  ClassroomIcon,
  NotebookLMIcon,
  GoogleLogo,
  CopyIcon
} from './components/Icons';
import { mergeAudioBlobs } from './utils/audioMixer';

export default function App() {
  // --- UI Translation State ---
  const [langInput, setLangInput] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Default: Korean
  const [langOutput, setLangOutput] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default: English
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isScrollLocked, setIsScrollLocked] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[0]);

  // --- UI Display State ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // --- Custom Hooks ---
  const {
    user,
    accessToken,
    isAdmin,
    isAuthReady,
    isLoginModalOpen,
    setIsLoginModalOpen,
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    emailAuthEmail,
    setEmailAuthEmail,
    emailAuthPassword,
    setEmailAuthPassword,
    emailAuthError,
    setEmailAuthError,
    isEmailAuthBusy,
    handleEmailLogin,
    handleEmailSignUp,
    handleLoginSelection,
    handleLogout,
  } = useAuth();

  const {
    history,
    setHistory,
    historyRenderLimit,
    setHistoryRenderLimit,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    isSessionsReady,
    isOutputOnly,
    setIsOutputOnly,
    handleNewConversation,
    handleMergeWithAbove,
    handleSplitItem,
    loadSession,
    deleteSession
  } = useConversationHistory();

  // --- UI Settings ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { driveBackupMode: 'manual', audioCacheEnabled: true, recordOriginalEnabled: true };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        driveBackupMode: parsed.driveBackupMode === 'auto' ? 'auto' : 'manual',
        audioCacheEnabled: typeof parsed.audioCacheEnabled === 'boolean' ? parsed.audioCacheEnabled : true,
        recordOriginalEnabled: typeof parsed.recordOriginalEnabled === 'boolean' ? parsed.recordOriginalEnabled : true,
      };
    } catch {
      return { driveBackupMode: 'manual', audioCacheEnabled: true, recordOriginalEnabled: true };
    }
  });

  const [uiLangCode, setUiLangCode] = useState<string>(() => {
    const saved = localStorage.getItem(UI_LANG_KEY);
    return saved || 'ko';
  });

  // --- Translation Helpers ---
  const t = TRANSLATIONS[uiLangCode] || TRANSLATIONS['ko'];

  const postApi = useCallback(async <T,>(endpoint: string, body: any): Promise<T> => {
    const resp = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API Error: ${resp.statusText}`);
    return resp.json();
  }, []);

  const translateText = async (text: string, id: string, fromLang: Language, toLang: Language) => {
    try {
      const data = await postApi<{ translated: string }>('translate', {
        text,
        from: fromLang.name,
        to: toLang.name,
        model: MODEL_TRANSLATE,
      });
      const translated = data.translated?.trim() || "";
      setHistory(prev => prev.map(item =>
        item.id === id ? { ...item, translated: translated, isTranslating: false } : item
      ));
      if (isAutoPlay && translated) {
        playTTS(translated, id);
      }
    } catch (e) {
      console.error("Translation failed", e);
      setHistory(prev => prev.map(item =>
        item.id === id ? { ...item, translated: "Error", isTranslating: false } : item
      ));
    }
  };

  // Gemini Props Helpers
  const onTranscriptReceived = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      const newItem: ConversationItem = {
        id: crypto.randomUUID(),
        original: text,
        translated: '',
        isTranslating: true,
        timestamp: Date.now(),
      };
      setHistory(prev => [...prev, newItem]);
      // Translate automatically
      translateText(text, newItem.id, langInput, langOutput);
    } else {
      setCurrentTurnText(text);
    }
  }, [langInput, langOutput, setHistory]);

  const onAudioReceived = useCallback((base64: string) => {
    // Gemini Live handles internal playback now
  }, []);

  const {
    status,
    isMicOn,
    errorMessage,
    analyser,
    isRecordingOriginal,
    connectToGemini,
    toggleMic,
    cleanupAudio,
    playPCM,
    setErrorMessage
  } = useGeminiLive({
    langInput,
    onTranscriptReceived,
    onAudioReceived,
    postApi,
    settings
  });

  // --- Remaining State ---
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [isNotebookLMGuideOpen, setIsNotebookLMGuideOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [visionNotifications, setVisionNotifications] = useState<VisionNotification[]>([]);
  const [activeVisionNotificationId, setActiveVisionNotificationId] = useState<string | null>(null);

  const [currentTurnText, setCurrentTurnText] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const pendingHistoryExpandRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const langInputRef = useRef(langInput);
  const langOutputRef = useRef(langOutput);
  const isLangAutoRef = useRef(false);

  // --- Phase 2 State ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editTranslatedText, setEditTranslatedText] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleDownloadSessionAudio = async (sessionItems: ConversationItem[], sessionTitle: string) => {
    try {
      const audioItems = sessionItems.filter(item => item.audioBase64);
      if (audioItems.length === 0) {
        alert(t.noAudioToExport || "재생 가능한 오디오가 없습니다.");
        return;
      }

      const blobs = audioItems.map(item => {
        const bytes = base64ToUint8Array(item.audioBase64!);
        return new Blob([bytes.buffer as any], { type: 'audio/wav' });
      });

      const mergedBlob = await mergeAudioBlobs(blobs);
      const url = URL.createObjectURL(mergedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionTitle || 'session'}_audio.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Audio export failed", e);
      alert("Audio export failed");
    }
  };

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const unreadVisionCount = visionNotifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    langInputRef.current = langInput;
  }, [langInput]);

  useEffect(() => {
    langOutputRef.current = langOutput;
  }, [langOutput]);

  // UI Effects
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsProfileMenuOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { }
  }, [settings]);

  useEffect(() => {
    if (!isAdmin) {
      setIsAdminPanelOpen(false);
    }
  }, [isAdmin]);


  // --- Logic ---
  const visibleHistory =
    historyRenderLimit >= history.length
      ? history
      : history.slice(Math.max(0, history.length - historyRenderLimit));
  const hiddenHistoryCount = Math.max(0, history.length - visibleHistory.length);

  const handleLoadMoreHistory = () => {
    const nextLimit = Math.min(historyRenderLimit + HISTORY_RENDER_STEP, history.length);
    if (nextLimit === historyRenderLimit) return;

    if (historyRef.current) {
      pendingHistoryExpandRef.current = {
        prevScrollHeight: historyRef.current.scrollHeight,
        prevScrollTop: historyRef.current.scrollTop,
      };
    }

    setHistoryRenderLimit(nextLimit);
  };

  useEffect(() => {
    setHistoryRenderLimit(200);
  }, [currentSessionId, setHistoryRenderLimit]);

  const openSettings = () => {
    setIsProfileMenuOpen(false);
    setIsSettingsModalOpen(true);
  };

  const handleExport = async (type: 'drive' | 'docs' | 'classroom' | 'notebooklm') => {
    setIsExportMenuOpen(false);
    if ((type === 'drive' || type === 'classroom' || type === 'notebooklm') && !accessToken) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsExporting(true);
    try {
      if (type === 'drive') {
        const result = await backupToDrive(accessToken!, history, {
          includeAudio: true,
          generateMissingAudio: true,
          voiceName: selectedVoice.name,
          ttsModel: MODEL_TTS,
        });
        if (result?.folderUrl) window.open(result.folderUrl, '_blank');
        alert(`Drive: ${t.exportSuccess}`);
      } else if (type === 'notebooklm') {
        const result = await backupToDrive(accessToken!, history, {
          includeAudio: false,
          generateMissingAudio: false,
          notebookLMMode: true,
        });
        if (result?.folderUrl) window.open(result.folderUrl, '_blank');
        setIsNotebookLMGuideOpen(true);
      } else if (type === 'docs') {
        if (accessToken) {
          await exportToDocs(accessToken, history);
          alert(`Docs: ${t.exportSuccess}`);
        } else {
          downloadTranscriptLocally(history);
          alert(t.offlineMode);
        }
      } else if (type === 'classroom') {
        setIsClassroomModalOpen(true);
        fetchCourses();
      }
    } catch (e) {
      console.error("Export failed", e);
      if (type === 'docs') {
        downloadTranscriptLocally(history);
        alert(t.offlineMode);
      } else {
        alert("Error: " + (e as Error).message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  const fetchCourses = async () => {
    if (!accessToken) return;
    setIsLoadingCourses(true);
    try {
      const list = await listCourses(accessToken);
      setCourses(list);
    } catch (e) {
      console.error("Failed to fetch courses", e);
      window.open('https://classroom.google.com', '_blank');
      setIsClassroomModalOpen(false);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const handleSubmitCourseWork = async (courseId: string) => {
    if (!accessToken) return;
    setIsExporting(true);
    try {
      await createCourseWork(accessToken, courseId, history);
      alert(t.exportSuccess);
      setIsClassroomModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to submit to Classroom");
    } finally {
      setIsExporting(false);
    }
  };


  const splitTextForTts = (text: string, maxLen: number): string[] => {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.length <= maxLen) return normalized ? [normalized] : [];
    const separators = new Set(['.', '!', '?', '。', '！', '？', '\n']);
    const sentences: string[] = [];
    let current = '';
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      current += ch;
      if (separators.has(ch)) {
        const s = current.trim();
        if (s) sentences.push(s);
        current = '';
      }
    }
    if (current.trim()) sentences.push(current.trim());
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (!buf) {
        if (s.length <= maxLen) buf = s;
        else {
          for (let i = 0; i < s.length; i += maxLen) {
            const part = s.slice(i, i + maxLen).trim();
            if (part) chunks.push(part);
          }
        }
        continue;
      }
      const next = `${buf} ${s}`;
      if (next.length <= maxLen) buf = next;
      else {
        chunks.push(buf);
        if (s.length <= maxLen) buf = s;
        else {
          for (let i = 0; i < s.length; i += maxLen) {
            const part = s.slice(i, i + maxLen).trim();
            if (part) chunks.push(part);
          }
          buf = '';
        }
      }
    }
    if (buf) chunks.push(buf);
    return chunks;
  };

  const playTTS = async (text: string, id?: string, notifyOnErrorValue: boolean = false): Promise<void> => {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    const cacheKey = id ? `${id}:${selectedVoice.name}:${MODEL_TTS}` : null;
    if (id) {
      const item = history.find(i => i.id === id);
      if (item?.audioBase64) return playPCM(item.audioBase64);
    }
    if (id && cacheKey && settings.audioCacheEnabled) {
      const cached = await getCachedAudioBase64(cacheKey);
      if (cached) {
        setHistory(prev => prev.map(item => item.id === id ? { ...item, audioBase64: cached } : item));
        return playPCM(cached);
      }
    }
    const chunks = splitTextForTts(normalized, 200);
    try {
      const pcmChunks: Uint8Array[] = [];
      for (const chunk of chunks) {
        const data = await postApi<{ audioBase64: string }>('tts', {
          text: chunk,
          voiceName: selectedVoice.name,
          model: MODEL_TTS,
        });
        if (data.audioBase64) {
          pcmChunks.push(base64ToUint8Array(data.audioBase64));
          await playPCM(data.audioBase64);
        }
      }
      if (id && pcmChunks.length > 0) {
        const totalLen = pcmChunks.reduce((sum, x) => sum + x.byteLength, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const x of pcmChunks) { merged.set(x, offset); offset += x.byteLength; }
        const mergedBase64 = arrayBufferToBase64(merged.buffer);
        setHistory(prev => prev.map(item => item.id === id ? { ...item, audioBase64: mergedBase64 } : item));
        if (cacheKey && settings.audioCacheEnabled) await setCachedAudioBase64(cacheKey, mergedBase64);
      }
    } catch (e) {
      console.error("TTS failed", e);
      if (notifyOnErrorValue) alert(`TTS 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const playAll = async () => {
    for (const item of history) {
      if (item.translated) {
        await playTTS(item.translated, item.id);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  const startEditing = useCallback((item: ConversationItem) => {
    setEditingItemId(item.id);
    setEditOriginalText(item.original);
    setEditTranslatedText(item.translated);
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    setHistory(prev => prev.map(item => item.id === id ? {
      ...item, original: editOriginalText, translated: editTranslatedText, updatedAt: Date.now()
    } : item));
    setEditingItemId(null);
  }, [editOriginalText, editTranslatedText, setHistory]);

  const [visionToastIds, setVisionToastIds] = useState<string[]>([]);
  const toastTimeoutsRef = useRef<Record<string, number>>({});

  const enqueueVisionToast = (id: string) => {
    setVisionToastIds(prev => [id, ...prev].slice(0, 3));
    if (toastTimeoutsRef.current[id]) window.clearTimeout(toastTimeoutsRef.current[id]);
    toastTimeoutsRef.current[id] = window.setTimeout(() => {
      setVisionToastIds(prev => prev.filter(x => x !== id));
      delete toastTimeoutsRef.current[id];
    }, 7000);
  };

  const dismissVisionToast = (id: string) => {
    setVisionToastIds(prev => prev.filter(x => x !== id));
    if (toastTimeoutsRef.current[id]) {
      window.clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
  };

  const openVisionNotification = (id: string) => {
    setActiveVisionNotificationId(id);
    setIsNotificationMenuOpen(false);
    setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    dismissVisionToast(id);
  };

  const handleVisionCaptured = async (payload: { blob: Blob }) => {
    const id = `vision_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const langA = langInputRef.current.code;
    const langB = langOutputRef.current.code;
    const item: VisionNotification = { id, timestamp: Date.now(), status: 'processing', isRead: false };
    setVisionNotifications(prev => [item, ...prev]);
    try {
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(payload.blob);
      });
      const result = await postApi<VisionResult>('vision', { base64Image, langA, langB, model: MODEL_VISION });
      setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'done', result } : n));
      enqueueVisionToast(id);
    } catch (e) {
      setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'error', error: String(e) } : n));
      enqueueVisionToast(id);
    }
  };

  const handleOpenHistory = async () => {
    setDriveRestoreMessage('');
    setSelectedDriveSessionId('');
    if (accessToken) {
      setIsLoadingDriveSessions(true);
      try {
        const list = await listDriveSessions(accessToken, 20);
        setDriveSessions(list || []);
      } catch (e) {
        console.error(e);
        setDriveSessions([]);
      } finally {
        setIsLoadingDriveSessions(false);
      }
    } else {
      setDriveSessions([]);
    }
    setIsHistoryModalOpen(true);
  };

  const [driveSessions, setDriveSessions] = useState<any[]>([]);
  const [isLoadingDriveSessions, setIsLoadingDriveSessions] = useState(false);
  const [selectedDriveSessionId, setSelectedDriveSessionId] = useState('');
  const [isRestoringDriveSession, setIsRestoringDriveSession] = useState(false);
  const [driveRestoreMessage, setDriveRestoreMessage] = useState('');

  const handleRestoreFromDrive = async (includeAudio: boolean) => {
    if (!accessToken || !selectedDriveSessionId) return;
    setIsRestoringDriveSession(true);
    setDriveRestoreMessage('복원 중...');
    try {
      const result = await restoreDriveSession(accessToken, selectedDriveSessionId, includeAudio);
      if (result?.history) {
        const now = Date.now();
        const newId = `drive_${now}`;
        setSessions(prev => [{
          id: newId, createdAt: now, updatedAt: now, items: result.history!,
          title: result.sessionName || result.history![0]?.original?.slice(0, 24) || 'Drive 세션'
        }, ...prev]);
        setCurrentSessionId(newId);
        setHistory(result.history);
      }
      setDriveRestoreMessage('복원을 완료했습니다.');
      setIsHistoryModalOpen(false);
    } catch (e) {
      console.error(e);
      setDriveRestoreMessage('복원에 실패했습니다.');
    } finally {
      setIsRestoringDriveSession(false);
    }
  };

  const [selectedLocalSessionId, setSelectedLocalSessionId] = useState('');

  const handleLoadSessionFromLocal = () => {
    if (!selectedLocalSessionId) return;
    const target = sessions.find(s => s.id === selectedLocalSessionId);
    if (target) {
      setCurrentSessionId(target.id);
      setHistory([...(target.items || [])]);
      setIsHistoryModalOpen(false);
    }
  };

  const handleClearLocalSessions = () => {
    clearSessions();
    setSelectedLocalSessionId('');
    clearCachedAudio();

    const now = Date.now();
    const initial: ConversationSession = {
      id: `local_${now}`,
      createdAt: now,
      updatedAt: now,
      items: [],
      title: '새 대화',
    };
    setSessions([initial]);
    setCurrentSessionId(initial.id);
    setHistory([]);
  };

  useEffect(() => {
    if (!isScrollLocked && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, currentTurnText, isScrollLocked]);

  useLayoutEffect(() => {
    if (!pendingHistoryExpandRef.current || !historyRef.current) return;
    const { prevScrollHeight, prevScrollTop } = pendingHistoryExpandRef.current;
    pendingHistoryExpandRef.current = null;
    const delta = historyRef.current.scrollHeight - prevScrollHeight;
    historyRef.current.scrollTop = prevScrollTop + delta;
  }, [historyRenderLimit]);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* --- HEADER --- */}
      <header className="px-5 py-3 bg-white border-b border-gray-100 flex flex-col z-20 shadow-sm shrink-0 gap-2">
        <div className="flex items-center justify-between gap-3">
          {/* Title & Logo */}
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:shadow-indigo-200 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <GlobeIcon />
            </div>
            <div className="flex flex-col leading-tight">
              <h1 className="font-bold text-sm sm:text-lg text-slate-800 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{t.appTitle}</h1>
              <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase whitespace-nowrap hidden sm:block group-hover:text-indigo-400 transition-colors">{t.subtitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-end">

            <button
              onClick={handleNewConversation}
              aria-label="새 대화"
              className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-90 text-xs font-bold text-gray-600 whitespace-nowrap"
            >
              <div className="group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="hidden sm:inline">새 대화</span>
            </button>

            <button
              onClick={handleOpenHistory}
              aria-label="이전 히스토리"
              className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-90 text-xs font-bold text-gray-600 whitespace-nowrap"
            >
              <div className="group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="hidden sm:inline">이전 히스토리</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                aria-label={t.exportMenu}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-90 text-xs font-bold text-gray-600 whitespace-nowrap"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                ) : (
                  <div className="scale-110"><ExportIcon /></div>
                )}
                <span className="hidden sm:inline">{isExporting ? t.exporting : t.exportMenu}</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                  <button onClick={() => handleExport('docs')} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 flex items-center gap-3 text-sm text-gray-700 font-bold border-b border-gray-50 transition-colors">
                    <div className="scale-110"><DocsIcon /></div> {t.exportDocs}
                  </button>
                  <button onClick={() => handleExport('drive')} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 flex items-center gap-3 text-sm text-gray-700 font-bold border-b border-gray-50 transition-colors">
                    <div className="scale-110"><DriveIcon /></div> {t.exportDrive}
                  </button>
                  <button onClick={() => handleExport('classroom')} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 flex items-center gap-3 text-sm text-gray-700 font-bold border-b border-gray-50 transition-colors">
                    <div className="scale-110"><ClassroomIcon /></div> {t.exportClassroom}
                  </button>
                  <button onClick={() => handleExport('notebooklm')} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50 flex items-center gap-3 text-sm text-gray-700 font-bold transition-colors">
                    <div className="scale-110"><NotebookLMIcon /></div> {t.exportNotebookLM}
                  </button>
                </div>
              )}
            </div>

            {!accessToken && (
              <span className="hidden sm:inline text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 whitespace-nowrap">
                Drive·Classroom 사용을 위해 Google 로그인이 필요합니다
              </span>
            )}

            <div className="relative" ref={notificationMenuRef}>
              <button
                onClick={() => setIsNotificationMenuOpen(!isNotificationMenuOpen)}
                aria-label="알림"
                className="relative flex items-center justify-center w-10 h-10 bg-white border border-gray-100 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg transition-all active:scale-90 group"
              >
                <div className="group-hover:scale-110 transition-transform"><BellIcon /></div>
                {unreadVisionCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm border-2 border-white animate-pulse">
                    {unreadVisionCount}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                  {visionNotifications.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400">알림이 없습니다.</div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto">
                      {visionNotifications.slice(0, 20).map((n) => {
                        const statusLabel =
                          n.status === 'processing'
                            ? t.visionAnalyzing
                            : n.status === 'done'
                              ? t.exportSuccess
                              : t.visionFail;

                        const statusClass =
                          n.status === 'processing'
                            ? 'text-gray-500'
                            : n.status === 'done'
                              ? 'text-emerald-600'
                              : 'text-red-600';

                        const snippet =
                          n.status === 'done'
                            ? (n.result?.translatedText || n.result?.originalText || t.visionNoText).trim().slice(0, 60)
                            : n.status === 'error'
                              ? (n.error || t.visionFail).trim().slice(0, 60)
                              : '';

                        return (
                          <button
                            key={n.id}
                            onClick={() => openVisionNotification(n.id)}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 hover:shadow-inner flex flex-col gap-1 border-b border-gray-50 last:border-0 transition-all group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {!n.isRead && n.status !== 'processing' ? (
                                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                                )}
                                <div className="text-xs font-bold text-gray-700 truncate group-hover:text-indigo-700 transition-colors">{t.visionTitle}</div>
                              </div>
                              <div className={`text-[10px] font-bold shrink-0 ${statusClass}`}>{statusLabel}</div>
                            </div>
                            {snippet ? (
                              <div className="text-[11px] text-gray-500 whitespace-pre-wrap break-words line-clamp-2 group-hover:text-gray-600 transition-colors">{snippet}</div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AUTH BUTTON */}
            {user && !user.isAnonymous ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-label="프로필 메뉴"
                  className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 border border-gray-100 shadow-sm whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-lg transition-all active:scale-90 group"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-white shadow-sm group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm group-hover:scale-110 transition-transform">{user.email ? user.email[0].toUpperCase() : (user.displayName ? user.displayName[0].toUpperCase() : 'U')}</div>
                  )}
                  <div className="group-hover:translate-x-0.5 transition-transform">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={openSettings}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium border-b border-gray-50"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      설정
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsAdminPanelOpen(true);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium border-b border-gray-50"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.59 21 9c0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        관리자 모드
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                aria-label="로그인"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 border border-indigo-700 rounded-full shadow-lg hover:shadow-indigo-200 hover:scale-105 hover:-translate-y-0.5 transition-all active:scale-90 text-xs font-black text-white whitespace-nowrap uppercase tracking-wider"
              >
                {uiLangCode === 'ko' ? '로그인' : 'Login'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Voice Selector */}
          <div className="flex items-center bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
            <span className="text-[10px] text-gray-500 font-bold mr-2 uppercase tracking-wide whitespace-nowrap group-hover:text-indigo-500 transition-colors">{t.voiceLabel}</span>
            <select
              value={selectedVoice.name}
              onChange={(e) => {
                const v = VOICE_OPTIONS.find(v => v.name === e.target.value);
                if (v) setSelectedVoice(v);
              }}
              className="bg-transparent text-xs font-bold text-indigo-600 outline-none cursor-pointer w-20"
            >
              {VOICE_OPTIONS.map(v => (
                <option key={v.name} value={v.name}>{v.label} ({v.gender})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOutputOnly(!isOutputOnly)}
              className={`px-4 py-2 rounded-full text-xs font-black border transition-all active:scale-90 shadow-sm whitespace-nowrap uppercase tracking-tighter ${isOutputOnly
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-700 border-indigo-700 text-white hover:shadow-indigo-200 hover:scale-105'
                : 'bg-white border-gray-100 text-gray-400 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg'
                }`}
            >
              출력만
            </button>

            {/* UI Language */}
            <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1.5 border border-gray-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all group min-w-[70px]">
              <div className="group-hover:text-indigo-500 transition-colors">
                <GlobeIcon />
              </div>
              <select
                value={uiLangCode}
                onChange={(e) => setUiLangCode(e.target.value)}
                className="bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer w-full"
              >
                <option value="ko">한국어</option>
                <option value="en">Eng</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
                <option value="es">Esp</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {visionToastIds.length > 0 && (
        <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]">
          {visionToastIds.map((id) => {
            const n = visionNotifications.find((x) => x.id === id);
            if (!n) return null;
            const title = t.visionTitle;
            const originalText = (n.result?.originalText || '').trim();
            const translatedText = (n.result?.translatedText || '').trim();
            const message =
              n.status === 'done'
                ? (translatedText || originalText || t.visionNoText)
                : n.status === 'error'
                  ? (n.error || t.visionFail)
                  : t.visionAnalyzing;

            const statusClass =
              n.status === 'done'
                ? 'text-emerald-700'
                : n.status === 'error'
                  ? 'text-red-700'
                  : 'text-gray-600';

            return (
              <div key={id} className="bg-white border border-gray-200 shadow-lg rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openVisionNotification(id)} className="flex-1 text-left">
                    <div className="text-xs font-bold text-gray-800">{title}</div>
                    <div className={`text-[11px] mt-1 whitespace-pre-wrap break-words line-clamp-3 ${statusClass}`}>{String(message).trim().slice(0, 160)}</div>
                  </button>
                  <button
                    onClick={() => dismissVisionToast(id)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    aria-label="닫기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- LANGUAGE & MODE CONTROLS --- */}
      <div className="bg-white px-4 py-4 shadow-sm z-10 flex flex-col gap-3 shrink-0">
        {/* Language Pair */}
        <div className="flex items-center justify-between gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
          {/* Input Language */}
          <div className="flex-1 flex flex-col items-center min-w-0 hover:bg-white hover:shadow-sm rounded-xl transition-all cursor-pointer group py-1">
            <span className="text-[10px] text-gray-800 font-bold mb-1 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{t.inputLang}</span>
            <div className="w-full relative px-2 py-1">
              <select
                value={langInput.code}
                onChange={(e) => {
                  isLangAutoRef.current = false;
                  const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                  if (l) setLangInput(l);
                }}
                className="opacity-0 absolute inset-0 w-full h-full z-10 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
              <div className="text-sm font-bold text-gray-900 truncate max-w-[120px] sm:max-w-xs text-center group-hover:scale-105 transition-transform">
                {langInput.flag} {langInput.name}
              </div>
            </div>
          </div>

          <div className="text-gray-300 shrink-0"><ArrowRightIcon /></div>

          {/* Output Language */}
          <div className="flex-1 flex flex-col items-center min-w-0 hover:bg-white hover:shadow-sm rounded-xl transition-all cursor-pointer group py-1">
            <span className="text-[10px] text-gray-800 font-bold mb-1 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{t.outputLang}</span>
            <div className="w-full relative px-2 py-1">
              <select
                value={langOutput.code}
                onChange={(e) => {
                  isLangAutoRef.current = false;
                  const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                  if (l) setLangOutput(l);
                }}
                className="opacity-0 absolute inset-0 w-full h-full z-10 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
              <div className="text-sm font-bold text-gray-900 truncate max-w-[120px] sm:max-w-xs text-center group-hover:scale-105 transition-transform">
                {langOutput.flag} {langOutput.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN LIST AREA (Split View) --- */}
      <div className="flex-1 overflow-hidden relative bg-slate-50 flex flex-col">
        {/* Visualizer Background */}
        <div className="absolute top-0 left-0 right-0 h-32 opacity-30 pointer-events-none z-0">
          <Visualizer analyser={analyser} isActive={isMicOn} color="#6366f1" />
        </div>

        {/* Scrollable Content */}
        <div
          ref={historyRef}
          className="flex-1 overflow-y-auto p-4 z-10 relative scroll-smooth"
        >
          {history.length === 0 && !currentTurnText && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-6 opacity-60">
              <MicIcon />
              <p className="mt-4 whitespace-pre-wrap text-sm">{t.emptyHint}</p>
              <div className="mt-4 w-full max-w-xl text-left space-y-2 text-[12px] text-gray-500 bg-white/80 border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="font-bold text-gray-700 text-sm">빠른 안내</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>마이크 버튼을 눌러 실시간 번역을 시작하세요.</li>
                  <li>Google 로그인 시 Drive 백업·Classroom 제출·Docs 저장 기능 사용 가능.</li>
                  <li>칠판 촬영(비전)으로 사진 속 텍스트를 감지해 번역합니다.</li>
                  <li>자동 읽기/자동 스크롤 토글로 듣기/보기 방식을 선택하세요.</li>
                </ul>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="font-bold text-gray-700">단축키</div>
                    <div className="mt-1 text-gray-500">스페이스: 마이크 on/off<br />Enter: 최근 번역 듣기</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="font-bold text-gray-700">모바일 팁</div>
                    <div className="mt-1 text-gray-500">하단 고정 버튼으로 한 손 조작, 세로 모드 최적화</div>
                  </div>
                </div>
              </div>
              <button
                onClick={toggleMic}
                className="mt-8 px-10 py-4 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-700 text-white text-base font-black shadow-xl hover:shadow-indigo-200 hover:scale-110 hover:-translate-y-1 transition-all active:scale-90 active:translate-y-0 ring-4 ring-indigo-50 animate-bounce"
              >
                {status === ConnectionStatus.CONNECTING
                  ? t.connecting
                  : status === ConnectionStatus.ERROR
                    ? t.retry
                    : '시작하려면 터치'}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {(status === ConnectionStatus.CONNECTING || status === ConnectionStatus.ERROR) && (
              <div
                className={`px-4 py-3 rounded-xl border shadow-sm flex items-start justify-between gap-3 ${status === ConnectionStatus.ERROR
                  ? 'bg-red-50 border-red-200'
                  : 'bg-indigo-50 border-indigo-100'
                  }`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold flex items-center gap-2 ${status === ConnectionStatus.ERROR ? 'text-red-700' : 'text-indigo-700'
                      }`}
                  >
                    {status === ConnectionStatus.CONNECTING && (
                      <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                    )}
                    <span>
                      {status === ConnectionStatus.CONNECTING ? t.connecting : t.connectionError}
                    </span>
                  </div>
                  {status === ConnectionStatus.ERROR && !!errorMessage && (
                    <div className="mt-1 text-xs text-red-700/80 break-words">{errorMessage}</div>
                  )}
                </div>
                {status === ConnectionStatus.ERROR && (
                  <button
                    onClick={() => {
                      setErrorMessage('');
                      connectToGemini();
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    {t.retry}
                  </button>
                )}
              </div>
            )}

            {hiddenHistoryCount > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadMoreHistory}
                  className="px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors text-xs font-bold text-gray-600"
                >
                  {t.loadMoreHistory}
                </button>
              </div>
            )}

            {visibleHistory.map((item) => {
              if (isOutputOnly) {
                return (
                  <div key={item.id} className="group border-b border-gray-100 pb-4 last:border-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div
                      className={`relative p-4 rounded-xl shadow-sm flex flex-col justify-between transition-colors ${item.isTranslating ? 'bg-gray-100 border border-gray-200' : 'bg-indigo-50 border border-indigo-100'
                        } ${!item.isTranslating && item.translated ? 'cursor-pointer hover:bg-indigo-100 active:scale-[0.99]' : ''
                        }`}
                      onClick={() => {
                        if (editingItemId === item.id) return;
                        if (!item.isTranslating && item.translated) {
                          playTTS(item.translated, item.id, true);
                        }
                      }}
                    >
                      {editingItemId === item.id ? (
                        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editTranslatedText}
                            onChange={(e) => setEditTranslatedText(e.target.value)}
                            className="w-full p-3 rounded-lg border border-indigo-200 text-sm md:text-base outline-none focus:ring-2 focus:ring-indigo-100 min-h-[100px]"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {!item.isTranslating && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMergeWithAbove(item.id);
                                }}
                                className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-gray-400"
                                title="위 항목과 병합"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(item);
                                }}
                                className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-gray-400"
                                title="수정"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                          {item.isTranslating ? (
                            <div className="flex gap-1 h-6 items-center">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                          ) : (
                            <span className="text-indigo-900 font-medium leading-relaxed text-sm md:text-base">{item.translated}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="group relative grid grid-cols-2 gap-4 items-stretch border-b border-gray-100 pb-4 last:border-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {editingItemId === item.id ? (
                    <div className="col-span-2 space-y-4 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Original</label>
                          <textarea
                            value={editOriginalText}
                            onChange={(e) => setEditOriginalText(e.target.value)}
                            className="w-full p-3 rounded-lg border border-gray-100 bg-gray-50 text-sm outline-none focus:border-indigo-300 min-h-[120px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-indigo-400 uppercase">Translated</label>
                          <textarea
                            value={editTranslatedText}
                            onChange={(e) => setEditTranslatedText(e.target.value)}
                            className="w-full p-3 rounded-lg border border-indigo-100 bg-indigo-50/30 text-sm outline-none focus:ring-2 focus:ring-indigo-100 min-h-[120px]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              const origArea = (e.currentTarget.parentElement?.parentElement?.parentElement?.querySelector('textarea') as HTMLTextAreaElement);
                              const transArea = (e.currentTarget.parentElement?.parentElement?.parentElement?.querySelectorAll('textarea')[1] as HTMLTextAreaElement);
                              handleSplitItem(item.id, origArea.selectionStart, transArea.selectionStart);
                            }}
                            className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100"
                          >
                            여기서 나누기
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {!item.isTranslating && (
                        <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMergeWithAbove(item.id);
                            }}
                            className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-gray-400"
                            title="위 항목과 병합"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(item);
                            }}
                            className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-gray-400"
                            title="수정"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${item.original}\n${item.translated}`);
                            }}
                            className="p-1.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all text-gray-400"
                            title="복사"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      )}
                      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm text-gray-800 leading-relaxed text-sm md:text-base">
                        {item.original}
                      </div>
                      <div
                        className={`relative p-4 rounded-xl shadow-sm flex flex-col justify-between transition-colors ${item.isTranslating ? 'bg-gray-100 border border-gray-200' : 'bg-indigo-50 border border-indigo-100'
                          } ${!item.isTranslating && item.translated ? 'cursor-pointer hover:bg-indigo-100 active:scale-[0.99]' : ''
                          }`}
                        onClick={() => {
                          if (!item.isTranslating && item.translated) {
                            playTTS(item.translated, item.id);
                          }
                        }}
                      >
                        {item.isTranslating ? (
                          <div className="flex gap-1 h-6 items-center">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                          </div>
                        ) : (
                          <span className="text-indigo-900 font-medium leading-relaxed text-sm md:text-base">{item.translated}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Live Transcription Placeholder (Left Side) */}
            {currentTurnText && (
              isOutputOnly ? (
                <div className="opacity-70">
                  <div className="flex items-center justify-center text-gray-300 text-sm italic border border-gray-200 border-dashed p-4 rounded-xl bg-white">
                    ...
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 opacity-70">
                  <div className="bg-gray-50 border border-gray-300 border-dashed p-4 rounded-xl text-gray-600 italic animate-pulse">
                    {currentTurnText}
                  </div>
                  <div className="flex items-center justify-center text-gray-300 text-sm italic">
                    ...
                  </div>
                </div>
              )
            )}
          </div>

          <div className="h-20"></div> {/* Spacer for bottom bar */}
        </div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="bg-white px-6 py-4 rounded-t-[2rem] shadow-[0_-5px_20px_rgba(0,0,0,0.05)] flex items-center justify-between z-30 shrink-0">

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 w-16 group ${isAutoPlay ? 'text-indigo-600' : 'text-gray-400'
              }`}
          >
            <div className={`p-3.5 rounded-full shadow-sm group-hover:shadow-xl group-hover:scale-110 transition-all ${isAutoPlay ? 'bg-indigo-100 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-gray-50 group-hover:bg-white border border-gray-100'
              }`}>
              <SpeakerIcon />
            </div>
            <span className="text-[10px] font-black tracking-tighter group-hover:text-indigo-600 transition-colors">{t.autoPlay}</span>
          </button>

          <button
            onClick={() => setIsScrollLocked(!isScrollLocked)}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-75 w-16 group ${!isScrollLocked ? 'text-indigo-600' : 'text-gray-400'
              }`}
          >
            <div className={`p-3.5 rounded-full shadow-sm group-hover:shadow-xl group-hover:scale-110 transition-all ${!isScrollLocked ? 'bg-indigo-100 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-gray-50 group-hover:bg-white border border-gray-100'
              }`}>
              {isScrollLocked ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 002-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <span className="text-[10px] font-black tracking-tighter group-hover:text-indigo-600 transition-colors">자동스크롤</span>
          </button>
        </div>

        {/* Main Mic */}
        <button
          onClick={toggleMic}
          className={`w-24 h-24 -mt-12 rounded-full flex items-center justify-center shadow-2xl border-4 border-white transition-all transform hover:scale-110 hover:brightness-110 active:scale-75 ${status === ConnectionStatus.CONNECTED
            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200 ring-8 ring-red-50'
            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-indigo-200 ring-8 ring-indigo-50'
            }`}
        >
          {status === ConnectionStatus.CONNECTING ? (
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : status === ConnectionStatus.CONNECTED ? (
            <div className="scale-150 animate-pulse"><MicOffIcon /></div>
          ) : (
            <div className="scale-150 group-hover:scale-175 transition-transform"><MicIcon /></div>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={playAll}
            className="flex flex-col items-center gap-1.5 text-gray-400 transition-all active:scale-75 w-16 group"
          >
            <div className="p-3.5 bg-gray-50 rounded-full shadow-sm border border-gray-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:scale-110 transition-all">
              <PlayAllIcon />
            </div>
            <span className="text-[10px] font-black tracking-tighter group-hover:text-indigo-600 transition-colors">{t.playAll}</span>
          </button>

          <button
            onClick={() => setIsCameraOpen(true)}
            className="flex flex-col items-center gap-1.5 text-gray-400 transition-all active:scale-75 w-16 group"
          >
            <div className="p-3.5 bg-gray-50 rounded-full shadow-sm border border-gray-100 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-xl group-hover:scale-110 transition-all">
              <CameraIcon />
            </div>
            <span className="text-[10px] font-black tracking-tighter group-hover:text-emerald-600 transition-colors">{t.visionButton}</span>
          </button>
        </div>
      </div>

      <CameraView
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptured={handleVisionCaptured}
        t={t}
      />

      <VisionNotificationModal
        notificationId={activeVisionNotificationId}
        notifications={visionNotifications}
        onClose={() => setActiveVisionNotificationId(null)}
        t={t}
      />

      {/* --- LOGIN MODAL --- */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        t={t}
        handleLoginSelection={handleLoginSelection}
        emailAuthEmail={emailAuthEmail}
        setEmailAuthEmail={setEmailAuthEmail}
        emailAuthPassword={emailAuthPassword}
        setEmailAuthPassword={setEmailAuthPassword}
        emailAuthError={emailAuthError}
        isEmailAuthBusy={isEmailAuthBusy}
        handleEmailLogin={handleEmailLogin}
        handleEmailSignUp={handleEmailSignUp}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        t={t}
        accessToken={accessToken}
        driveSessions={driveSessions}
        isLoadingDriveSessions={isLoadingDriveSessions}
        selectedDriveSessionId={selectedDriveSessionId}
        setSelectedDriveSessionId={setSelectedDriveSessionId}
        isRestoringDriveSession={isRestoringDriveSession}
        driveRestoreMessage={driveRestoreMessage}
        handleRestoreFromDrive={handleRestoreFromDrive}
        sessions={sessions}
        selectedLocalSessionId={selectedLocalSessionId}
        setSelectedLocalSessionId={setSelectedLocalSessionId}
        handleLoadSessionFromLocal={handleLoadSessionFromLocal}
        handleClearLocalSessions={handleClearLocalSessions}
        handleDownloadSessionAudio={(s) => handleDownloadSessionAudio(s.items, s.title)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        setSettings={setSettings}
        t={t}
      />

      <ClassroomModal
        isOpen={isClassroomModalOpen}
        onClose={() => setIsClassroomModalOpen(false)}
        t={t}
        courses={courses}
        isLoadingCourses={isLoadingCourses}
        isExporting={isExporting}
        onSubmit={handleSubmitCourseWork}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen && isAdmin}
        onClose={() => setIsAdminPanelOpen(false)}
        user={user}
        accessToken={accessToken}
        sessionsCount={sessions.length}
        historyCount={history.length}
      />

      <NotebookLMGuide
        isOpen={isNotebookLMGuideOpen}
        onClose={() => setIsNotebookLMGuideOpen(false)}
      />

    </div>
  );
}

