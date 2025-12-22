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
  listDriveSessions,
  restoreDriveSession,
  listCourses,
  createCourseWork
} from './utils/googleWorkspace';
import { downloadTranscriptLocally } from './utils/fileExport';
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
import SummaryModal from './components/SummaryModal';
import AppHeader from './components/AppHeader';
import LanguageSelector from './components/LanguageSelector';
import ConversationList from './components/ConversationList';
import BottomControls from './components/BottomControls';
import ExportMenu from './components/ExportMenu';
import VisionToastSystem from './components/VisionToastSystem';

import { useAuth } from './hooks/useAuth';
import { useConversationHistory } from './hooks/useConversationHistory';
import { useGeminiLive } from './hooks/useGeminiLive';
import { useExport } from './hooks/useExport';
import { useVision } from './hooks/useVision';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useStorage } from './hooks/useStorage';
import { useTranslationService } from './hooks/useTranslationService';
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
  CopyIcon,
  SparklesIcon
} from './components/Icons';

export default function App() {
  // --- UI Translation State ---
  const [langInput, setLangInput] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Default: Korean
  const [langOutput, setLangOutput] = useState<Language>(SUPPORTED_LANGUAGES[4]); // Default: Vietnamese
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
    handleMergeWithAbove,
    handleMergeWithBelow,
    handleSplitItem,
    handleSaveEdit,
    handleClearSessions,
    loadSession,
    deleteSession
  } = useConversationHistory();

  // --- UI Settings ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { driveBackupMode: 'manual', audioCacheEnabled: true, recordOriginalEnabled: true, userApiKey: '' };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        driveBackupMode: parsed.driveBackupMode === 'auto' ? 'auto' : 'manual',
        audioCacheEnabled: typeof parsed.audioCacheEnabled === 'boolean' ? parsed.audioCacheEnabled : true,
        recordOriginalEnabled: typeof parsed.recordOriginalEnabled === 'boolean' ? parsed.recordOriginalEnabled : true,
        userApiKey: typeof parsed.userApiKey === 'string' ? parsed.userApiKey : '',
      };
    } catch {
      return { driveBackupMode: 'manual', audioCacheEnabled: true, recordOriginalEnabled: true, userApiKey: '' };
    }
  });

  const [uiLangCode, setUiLangCode] = useState<string>(() => {
    const saved = localStorage.getItem(UI_LANG_KEY);
    return saved || 'ko';
  });

  // --- Translation Helpers ---
  const t = TRANSLATIONS[uiLangCode] || TRANSLATIONS['ko'];

  // --- Custom Service: Translation & API ---
  const {
    postApi,
    translateText
  } = useTranslationService({
    settings,
    setHistory,
    isAutoPlay,
    playTTS: (text, id) => playTTS(text, id),
    MODEL_TRANSLATE
  });

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

  // --- Custom Service: Audio & TTS ---
  const {
    playTTS,
    playAll,
    handleDownloadSessionAudio
  } = useAudioPlayer({
    history,
    setHistory,
    selectedVoice,
    settings,
    postApi,
    playPCM,
    MODEL_TTS,
    t
  });

  const {
    isExportMenuOpen,
    setIsExportMenuOpen,
    isExporting,
    isClassroomModalOpen,
    setIsClassroomModalOpen,
    isNotebookLMGuideOpen,
    setIsNotebookLMGuideOpen,
    courses,
    isLoadingCourses,
    exportMenuRef,
    handleExport,
    handleSubmitCourseWork
  } = useExport({
    accessToken,
    history,
    selectedVoice,
    t,
    setIsLoginModalOpen
  });

  // --- Custom Service: Vision & Storage ---
  const {
    visionNotifications,
    setVisionNotifications,
    activeVisionNotificationId,
    setActiveVisionNotificationId,
    visionToastIds,
    handleVisionCaptured,
    openVisionNotification,
    dismissVisionToast
  } = useVision({ postApi, langInput, langOutput, MODEL_VISION });

  const {
    driveSessions,
    isLoadingDriveSessions,
    selectedDriveSessionId,
    setSelectedDriveSessionId,
    isRestoringDriveSession,
    driveRestoreMessage,
    setDriveRestoreMessage,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    selectedLocalSessionId,
    setSelectedLocalSessionId,
    handleOpenHistory,
    handleRestoreFromDrive
  } = useStorage({ accessToken, setHistory, setCurrentSessionId });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const [currentTurnText, setCurrentTurnText] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const pendingHistoryExpandRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const langInputRef = useRef(langInput);
  const langOutputRef = useRef(langOutput);
  const isLangAutoRef = useRef(false);

  // --- Editing State ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editTranslatedText, setEditTranslatedText] = useState('');

  const startEditing = useCallback((item: ConversationItem) => {
    setEditingItemId(item.id);
    setEditOriginalText(item.original);
    setEditTranslatedText(item.translated);
  }, []);

  const handleSaveEditAction = useCallback((id: string) => {
    handleSaveEdit(id, editOriginalText, editTranslatedText);
    setEditingItemId(null);
  }, [editOriginalText, editTranslatedText, handleSaveEdit]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // const exportMenuRef = useRef<HTMLDivElement>(null); // Moved to useExport
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const unreadVisionCount = visionNotifications.filter((n) => !n.isRead).length;

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

  const handleSummarize = async () => {
    if (history.length < 2) {
      alert("대화 내용이 너무 적어 요약할 수 없습니다.");
      return;
    }
    setIsSummaryModalOpen(true);
    setIsSummarizing(true);
    try {
      const historyText = history.map(h => `${h.original}\n${h.translated}`).join('\n\n');
      const data = await postApi<{ summary: string }>('summarize', {
        history: historyText,
        lang: uiLangCode
      });
      setSummaryText(data.summary);
    } catch (e) {
      console.error(e);
      setSummaryText("요약에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleOpenSettingsAction = () => {
    setIsProfileMenuOpen(false);
    setIsSettingsModalOpen(true);
  };

  const handleClearLocalSessionsAction = () => {
    clearCachedAudio();
    handleClearSessions();
  };

  const handleLoadSessionFromLocal = () => {
    if (!selectedLocalSessionId) return;
    const target = sessions.find(s => s.id === selectedLocalSessionId);
    if (target) {
      loadSession(target);
      setIsHistoryModalOpen(false);
    }
  };

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
  }, [setIsProfileMenuOpen, setIsExportMenuOpen, setIsNotificationMenuOpen, exportMenuRef, profileMenuRef, notificationMenuRef]);

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

  useEffect(() => {
    setHistoryRenderLimit(200);
  }, [currentSessionId, setHistoryRenderLimit]);

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
    <div className="flex flex-col h-screen h-[100dvh] bg-slate-50 font-sans text-gray-900 overflow-hidden select-none">
      <AppHeader
        user={user}
        accessToken={accessToken}
        isAdmin={isAdmin}
        handleLogout={handleLogout}
        isProfileMenuOpen={isProfileMenuOpen}
        setIsProfileMenuOpen={setIsProfileMenuOpen}
        setIsHistoryModalOpen={setIsHistoryModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        setIsAdminPanelOpen={setIsAdminPanelOpen}
        setIsLoginModalOpen={setIsLoginModalOpen}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        isOutputOnly={isOutputOnly}
        setIsOutputOnly={setIsOutputOnly}
        uiLangCode={uiLangCode}
        setUiLangCode={setUiLangCode}
        setIsExportMenuOpen={setIsExportMenuOpen}
        handleSummarize={handleSummarize}
        t={t}
      />

      <ExportMenu
        isOpen={isExportMenuOpen}
        menuRef={exportMenuRef}
        onExport={handleExport}
        t={t}
      />

      <VisionToastSystem
        toastIds={visionToastIds}
        notifications={visionNotifications}
        onOpen={openVisionNotification}
        onDismiss={dismissVisionToast}
        t={t}
      />

      <LanguageSelector
        langInput={langInput}
        setLangInput={setLangInput}
        langOutput={langOutput}
        setLangOutput={setLangOutput}
        t={t}
        onLanguageManualSelect={() => { isLangAutoRef.current = false; }}
      />

      <ConversationList
        analyser={analyser}
        isMicOn={isMicOn}
        history={history}
        currentTurnText={currentTurnText}
        isOutputOnly={isOutputOnly}
        historyRef={historyRef}
        t={t}
        status={status}
        errorMessage={errorMessage}
        connectToGemini={connectToGemini}
        toggleMic={toggleMic}
        editingItemId={editingItemId}
        setEditingItemId={setEditingItemId}
        editOriginalText={editOriginalText}
        setEditOriginalText={setEditOriginalText}
        editTranslatedText={editTranslatedText}
        setEditTranslatedText={setEditTranslatedText}
        startEditing={startEditing}
        handleSaveEdit={handleSaveEditAction}
        handleMergeWithAbove={handleMergeWithAbove}
        handleMergeWithBelow={handleMergeWithBelow}
        handleSplitItem={handleSplitItem}
        copyToClipboard={copyToClipboard}
        playTTS={playTTS}
      />

      <BottomControls
        isAutoPlay={isAutoPlay}
        setIsAutoPlay={setIsAutoPlay}
        isScrollLocked={isScrollLocked}
        setIsScrollLocked={setIsScrollLocked}
        status={status}
        toggleMic={toggleMic}
        playAll={playAll}
        setIsCameraOpen={setIsCameraOpen}
        t={t}
      />

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
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryText={summaryText}
        isSummarizing={isSummarizing}
        t={t}
      />

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
        handleClearLocalSessions={handleClearLocalSessionsAction}
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

    </div >
  );
}

