import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  getAppAuth, 
  logOut, 
  signInAsGuest
} from './utils/firebase';
import { loadHistory, saveHistory, loadSessions, saveSession, deleteSession, Session } from './utils/localStorage';
import { 
  backupToDrive, 
  exportToDocs, 
  downloadTranscriptLocally, 
  listCourses,
  createCourseWork
} from './utils/googleWorkspace';
import { Language, ConnectionStatus, VoiceOption, ConversationItem } from './types';
import { 
  SUPPORTED_LANGUAGES, 
  MODEL_LIVE, 
  MODEL_TTS, 
  TRANSLATIONS, 
  VOICE_OPTIONS,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES
} from './constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from './utils/audioUtils';
import Visualizer from './components/Visualizer';

// --- Icons ---
const MicIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
const MicOffIcon = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 5.586a2 2 0 012.828 0l-.793.793-2.828-2.828.793-.793zM11 18.172l-6.586-6.586a2 2 0 002.828 2.828L11 18.172zm9.9-9.9l-6.586 6.586a2 2 0 01-2.828-2.828l6.586-6.586a2 2 0 012.828 2.828z" /><line x1="1" y1="1" x2="23" y2="23" strokeWidth={2} /></svg>;
const LensIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>;
const ArrowRightIcon = () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>;
const SpeakerIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>;
const PlayAllIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const GlobeIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ExportIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const HistoryIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const XIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const LockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const UnlockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>;
const ScrollDownIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;

// --- Brand Icons (Official Colors) ---
const DocsIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.5 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V7.5L14.5 2Z" fill="#4285F4"/>
    <path d="M14 2V8H20" fill="#A1C2FA"/>
    <path d="M14 2V8H20" fillOpacity="0.3" fill="black"/>
    <path d="M7 11H14V13H7V11ZM7 15H17V17H7V15ZM7 7H12V9H7V7Z" fill="white"/>
  </svg>
);

const DriveIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="M43.65 25l13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2l-13.75 23.8z" fill="#00ac47"/>
    <path d="M73.55 76.8c1.55 0 3.1-.4 4.5-1.2l3.85-6.65c.8-1.4 1.2-2.95 1.2-4.5h-27.5z" fill="#ea4335"/>
    <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.95-3.3 3.3l-20 34.6 13.75 23.8z" fill="#00832d"/>
    <path d="M86.4 50.85l-13.75-23.8C71.85 25.7 70.7 24.55 69.35 23.75L49.95 23.75l13.75 23.8z" fill="#2684fc"/>
    <path d="M73.55 76.8h-29.9l-13.75-23.8h57.4c0 1.6-.45 3.15-1.25 4.55z" fill="#ffba00"/>
  </svg>
);

const ClassroomIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#0F9D58" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
    <path fill="#0F9D58" d="M12 6c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    <circle cx="12" cy="10" r="1.5" fill="#F6BB16" />
    <path d="M12 12.5c-1.67 0-5 .83-5 2.5V16h10v-1c0-1.67-3.33-2.5-5-2.5z" fill="#F6BB16"/>
  </svg>
);

// Google Logo for Login Button
const GoogleLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function App() {
  // --- UI Settings ---
  const [uiLangCode, setUiLangCode] = useState('ko');
  const t = TRANSLATIONS[uiLangCode] || TRANSLATIONS['ko'];

  // --- Translation Logic Settings ---
  const [langInput, setLangInput] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Default: Korean
  const [langOutput, setLangOutput] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default: English
  // Changed Auto Play default to false as requested
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[0]);
  const [viewMode, setViewMode] = useState<'both' | 'output'>('both');
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // We need a ref for isAutoPlay to access it inside the Live API callback
  const isAutoPlayRef = useRef(isAutoPlay);
  useEffect(() => {
    isAutoPlayRef.current = isAutoPlay;
  }, [isAutoPlay]);

  // --- Status & Media ---
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isMicOn, setIsMicOn] = useState(false);
  // Removed internal camera state
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // --- Auth & Data ---
  const [user, setUser] = useState<User | any | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null); 
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [currentTurnText, setCurrentTurnText] = useState('');
  const [currentResponseText, setCurrentResponseText] = useState('');
  
  // Sessions
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const historyRef = useRef<HTMLDivElement>(null);

  // --- Modals State ---
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // --- Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Audio playback queue
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // GIS Token Client Ref
  const tokenClient = useRef<any>(null);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  // 1. Initialize Auth on Mount
  useEffect(() => {
    // A. Guest Auth (Firebase)
    const initGuestAuth = async () => {
      const auth = getAppAuth();
      if (!auth.currentUser) {
        try {
          if (!user && !accessToken) {
             await signInAsGuest();
          }
        } catch (error) {
          console.error('Anonymous sign in failed:', error);
        }
      }
    };
    const timer = setTimeout(initGuestAuth, 500); 

    // B. Initialize GIS (Google Identity Services)
    const initGis = () => {
      if (window.google && window.google.accounts) {
        try {
          tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: async (response: any) => {
              if (response.error) {
                console.error("GIS Error:", response);
                alert("Google Login Failed: " + JSON.stringify(response.error));
                return;
              }
              const token = response.access_token;
              setAccessToken(token);
              
              // Fetch User Profile
              try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const userInfo = await userInfoRes.json();
                
                setUser({
                  uid: userInfo.sub,
                  email: userInfo.email,
                  displayName: userInfo.name,
                  photoURL: userInfo.picture,
                  isAnonymous: false
                });
                setIsLoginModalOpen(false);
              } catch (e) {
                console.error("Failed to fetch user info", e);
                alert("Login succeeded but failed to fetch user profile.");
              }
            },
          });
          setIsGisLoaded(true);
        } catch (e) {
           console.error("GIS Initialization Failed:", e);
        }
      } else {
        setTimeout(initGis, 500); // Retry if script not loaded yet
      }
    };
    initGis();

    // Load Sessions
    setSessions(loadSessions());

    return () => {
      clearTimeout(timer);
    };
  }, []); 
  
  // 2. Monitor Firebase Auth State (Guest/Google)
  useEffect(() => {
    const auth = getAppAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Only set guest user if we are NOT logged in via Google (accessToken)
      if (!accessToken) {
         setUser(firebaseUser);
      }
      
      if (firebaseUser || accessToken) {
        const localData = loadHistory();
        setHistory(localData);
      } else {
        setHistory([]); 
      }
    });
    return () => unsubscribe();
  }, [accessToken]);

  // 3. Save History & Session Logic
  useEffect(() => {
    // Save to active local history
    if (history.length > 0) {
      saveHistory(history);
      
      // Also update the session entry if it exists
      const preview = history[history.length - 1].translated || history[history.length - 1].original || "New conversation";
      saveSession({
        id: sessionId,
        date: parseInt(sessionId), // simplified for this example
        preview: preview.substring(0, 50),
        items: history
      });
      setSessions(loadSessions());
    }
  }, [history, sessionId]);

  // Close export menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Logic ---
  
  const handleNewChat = () => {
    setHistory([]);
    setSessionId(Date.now().toString());
    setCurrentTurnText('');
    setCurrentResponseText('');
    setIsSidebarOpen(false);
  };
  
  const handleLoadSession = (session: Session) => {
    setHistory(session.items);
    setSessionId(session.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteSession(id);
    setSessions(updated);
    if (id === sessionId) {
      handleNewChat();
    }
  };

  const handleLoginSelection = async (type: 'google' | 'guest') => {
    if (type === 'google') {
      if (tokenClient.current) {
        // Trigger GIS Popup
        tokenClient.current.requestAccessToken({});
      } else if (window.google && window.google.accounts) {
        // Retry init if waiting
        try {
           tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: async (response: any) => {
              if (response.error) {
                alert("Error: " + response.error);
                return;
              }
              const token = response.access_token;
              setAccessToken(token);
              // Fetch User Profile
              try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const userInfo = await userInfoRes.json();
                setUser({
                  uid: userInfo.sub,
                  email: userInfo.email,
                  displayName: userInfo.name,
                  photoURL: userInfo.picture,
                  isAnonymous: false
                });
                setIsLoginModalOpen(false);
              } catch (e) { console.error(e); }
            },
          });
          tokenClient.current.requestAccessToken({});
        } catch(e) {
          alert("Google Sign-In script error. Please refresh the page.");
        }
      } else {
        alert("Google Sign-In is still initializing. Please check your internet connection and try again.");
      }
    } else {
      if (!user || !user.isAnonymous) {
        await signInAsGuest();
      }
      setIsLoginModalOpen(false);
    }
  };

  const handleLogout = async () => {
    // GIS Logout
    if (accessToken) {
      if (window.google && window.google.accounts) {
         window.google.accounts.oauth2.revoke(accessToken, () => {});
      }
      setAccessToken(null);
    }
    
    // Firebase Logout
    await logOut();
    setUser(null);
  };

  const handleExport = async (type: 'drive' | 'docs' | 'classroom') => {
    setIsExportMenuOpen(false);
    if (type === 'drive' || type === 'classroom') {
      if (!accessToken) {
        setIsLoginModalOpen(true);
        return;
      }
    }

    setIsExporting(true);

    try {
      if (type === 'drive') {
        await backupToDrive(accessToken!, history);
        alert(`Drive: ${t.exportSuccess}`);
      } 
      else if (type === 'docs') {
        if (accessToken) {
           await exportToDocs(accessToken, history);
           alert(`Docs: ${t.exportSuccess}`);
        } else {
           downloadTranscriptLocally(history);
           alert(t.offlineMode);
        }
      } 
      else if (type === 'classroom') {
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

  // --- Cleanup ---
  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Stop any playing audio
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    audioSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    
    setAnalyser(null);
  }, []);

  const playAudioFromBase64 = async (base64String: string): Promise<void> => {
    return new Promise(async (resolve) => {
      try {
        const playbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(base64ToUint8Array(base64String), playbackCtx, 24000);
        const source = playbackCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackCtx.destination);
        source.onended = () => {
          playbackCtx.close();
          resolve();
        };
        source.start();
      } catch (e) {
        console.error("Audio playback error", e);
        resolve();
      }
    });
  };

  const playTTS = async (text: string, id?: string): Promise<void> => {
    if (!text) return Promise.resolve();
    if (id) {
      const item = history.find(i => i.id === id);
      if (item?.audioBase64) {
        return playAudioFromBase64(item.audioBase64);
      }
    }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: { parts: [{ text: text }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.name } },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (id) {
          setHistory(prev => prev.map(item => 
             item.id === id ? { ...item, audioBase64: base64Audio } : item
          ));
        }
        return playAudioFromBase64(base64Audio);
      }
    } catch (e) {
      console.error("TTS generation failed", e);
    }
    return Promise.resolve();
  };

  const playAll = async () => {
    for (const item of history) {
      if (item.translated) {
        await playTTS(item.translated, item.id);
        await new Promise(r => setTimeout(r, 500)); 
      }
    }
  };

  const connectToGemini = useCallback(async () => {
    try {
      cleanupAudio();
      setStatus(ConnectionStatus.CONNECTING);

      if (!process.env.API_KEY) {
        setStatus(ConnectionStatus.ERROR);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await inputAudioContextRef.current.resume();
      await audioContextRef.current.resume();

      const analyserNode = audioContextRef.current.createAnalyser();
      analyserNode.fftSize = 256;
      setAnalyser(analyserNode);

      // --- UPDATED SYSTEM INSTRUCTION FOR BIDIRECTIONAL TRANSLATION ---
      const instruction = `
You are a real-time BIDIRECTIONAL translation assistant for Global Classroom.
You are the interpreter between two languages: ${langInput.name} (Language A) and ${langOutput.name} (Language B).

CORE RESPONSIBILITIES:
1. Listen to the audio input.
2. Automatically detect which language is being spoken.
3. If the user speaks ${langInput.name}, translate it immediately to ${langOutput.name}.
4. If the user speaks ${langOutput.name}, translate it immediately to ${langInput.name}.

BEHAVIOR:
- Respond immediately when a sentence boundary is detected.
- Provide smooth, natural translations.
- Do NOT provide the original transcription in the output, ONLY the translation.
- If the input is mixed, translate it to the "other" primary language of the context.
      `;

      const sessionPromise = ai.live.connect({
        model: MODEL_LIVE,
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.name } },
          },
          systemInstruction: instruction, 
          inputAudioTranscription: {},
          outputAudioTranscription: {}, // Request text of what the model speaks (the translation)
        },
        callbacks: {
          onopen: async () => {
            console.log("Gemini Live Connected");
            setStatus(ConnectionStatus.CONNECTED);
            setIsMicOn(true);
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              if (!inputAudioContextRef.current) return;
              
              const source = inputAudioContextRef.current.createMediaStreamSource(stream);
              const inputGain = inputAudioContextRef.current.createGain();
              inputGain.gain.value = 1.5; 
              source.connect(inputGain);

              const visSource = audioContextRef.current!.createMediaStreamSource(stream);
              const visGain = audioContextRef.current!.createGain();
              visGain.gain.value = 1.5;
              visSource.connect(visGain);
              visGain.connect(analyserNode);

              const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                if (sessionPromiseRef.current) {
                  sessionPromiseRef.current.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                  });
                }
              };

              inputGain.connect(processor);
              processor.connect(inputAudioContextRef.current.destination);
            } catch (err) {
              console.error("Mic Error:", err);
              setStatus(ConnectionStatus.ERROR);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Input Transcription (User Speech)
            const inputTrans = message.serverContent?.inputTranscription?.text;
            if (inputTrans) {
              setCurrentTurnText(prev => prev + inputTrans);
            }

            // 2. Handle Output Transcription (Model Translation Text)
            const outputTrans = message.serverContent?.outputTranscription?.text;
            if (outputTrans) {
              setCurrentResponseText(prev => prev + outputTrans);
            }

            // 3. Handle Input Turn Complete (User finished a sentence)
            if (message.serverContent?.turnComplete) {
              // We only commit the INPUT text here. 
              // The translation might still be coming in or will come shortly.
              setCurrentTurnText(finalText => {
                if (finalText.trim()) {
                  // Push a new history item with the input text
                  // We will update the 'translated' field of this item as the model responds
                  setHistory(prev => [
                    ...prev, 
                    {
                      id: Date.now().toString(),
                      original: finalText.trim(),
                      translated: "", // Will be filled by currentResponseText
                      isTranslating: true,
                      timestamp: Date.now()
                    }
                  ]);
                }
                return "";
              });
            }

            // 4. Handle Output Audio (Model Translation Speech)
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            // Only play audio if isAutoPlay is enabled (checked via Ref)
            if (base64Audio && isAutoPlayRef.current) {
               if (audioContextRef.current) {
                  const ctx = audioContextRef.current;
                  // Calculate next start time for gapless playback
                  const currentTime = ctx.currentTime;
                  if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                  }
                  
                  try {
                    const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), ctx, 24000);
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    audioSourcesRef.current.push(source);
                    source.onended = () => {
                       const index = audioSourcesRef.current.indexOf(source);
                       if (index > -1) audioSourcesRef.current.splice(index, 1);
                    };
                  } catch(e) {
                    console.error("Error decoding stream audio", e);
                  }
               }
            }
            
            // 5. Update the latest history item with the accumulating translation text
            // Note: In streaming, we update the last item that is marked as 'isTranslating'
            setCurrentResponseText(currentResponse => {
               if (currentResponse) {
                  setHistory(prev => {
                     const lastIndex = prev.length - 1;
                     if (lastIndex >= 0 && prev[lastIndex].isTranslating) {
                        const newHistory = [...prev];
                        newHistory[lastIndex] = {
                           ...newHistory[lastIndex],
                           translated: currentResponse
                        };
                        return newHistory;
                     }
                     return prev;
                  });
               }
               return currentResponse;
            });

            // 6. Handle "Interrupted" or Model Turn Complete
            if (message.serverContent?.interrupted) {
               audioSourcesRef.current.forEach(s => s.stop());
               audioSourcesRef.current = [];
               nextStartTimeRef.current = 0;
               setCurrentResponseText(""); 
               // Mark last item as done translating if interrupted? 
               setHistory(prev => prev.map(item => ({...item, isTranslating: false})));
            } else if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
               // Sometimes model sends text in modelTurn directly
            }
          },
          onclose: () => {
            console.log("Session Closed");
            setStatus(ConnectionStatus.DISCONNECTED);
            setIsMicOn(false);
          },
          onerror: (err) => {
            console.error("Session Error:", err);
            setStatus(ConnectionStatus.ERROR);
            setIsMicOn(false);
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error) {
      console.error("Connection setup failed:", error);
      setStatus(ConnectionStatus.ERROR);
    }
  }, [langInput, langOutput, selectedVoice, cleanupAudio]); 

  const toggleMic = () => {
    if (status === ConnectionStatus.CONNECTED) {
       if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then(session => session.close());
       }
       cleanupAudio();
       setStatus(ConnectionStatus.DISCONNECTED);
       setIsMicOn(false);
    } else {
      if (!user) setHistory([]); 
      connectToGemini();
    }
  };

  // Scroll to bottom logic with lock check
  useEffect(() => {
    if (isAutoScroll && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history, currentTurnText, currentResponseText, isAutoScroll]);

  const openGoogleLens = () => {
    window.open('https://lens.google.com', '_blank');
  };

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      {/* --- HISTORY SIDEBAR --- */}
      {isSidebarOpen && (
        <>
          <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
             <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-lg">History</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
               {sessions.length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">No history yet.</div>}
               {sessions.map(session => (
                 <div key={session.id} 
                      onClick={() => handleLoadSession(session)}
                      className={`group p-3 rounded-xl border cursor-pointer transition-all hover:bg-indigo-50 hover:border-indigo-100 ${sessionId === session.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'}`}>
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-gray-400 font-medium mb-1">{new Date(session.date).toLocaleString()}</div>
                      <button onClick={(e) => handleDeleteSession(e, session.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="text-sm text-gray-700 line-clamp-2 font-medium">{session.preview || "Empty session"}</div>
                 </div>
               ))}
             </div>
          </div>
        </>
      )}

      {/* --- HEADER --- */}
      <header className="px-5 py-3 bg-white border-b border-gray-100 flex flex-wrap sm:flex-nowrap justify-between items-center z-20 shadow-sm shrink-0 gap-3">
        {/* Title & Logo */}
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">AI</div>
           <h1 className="font-bold text-md text-slate-800 whitespace-nowrap">{t.appTitle}</h1>
        </div>

        {/* Global Settings (Right Side) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap justify-end flex-1">
           {/* Session Controls */}
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="History">
              <HistoryIcon />
           </button>
           <button onClick={handleNewChat} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors font-bold mr-2" title="New Chat">
              <PlusIcon />
           </button>

           {/* Export Dropdown */}
           <div className="relative" ref={exportMenuRef}>
             <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors text-xs font-bold text-gray-600 whitespace-nowrap"
             >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                ) : (
                  <ExportIcon />
                )}
                <span className="hidden sm:inline">{isExporting ? t.exporting : t.exportMenu}</span>
             </button>

             {isExportMenuOpen && (
               <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                 <button onClick={() => handleExport('docs')} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium border-b border-gray-50">
                   <DocsIcon /> {t.exportDocs}
                 </button>
                 <button onClick={() => handleExport('drive')} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium border-b border-gray-50">
                   <DriveIcon /> {t.exportDrive}
                 </button>
                 <button onClick={() => handleExport('classroom')} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 font-medium">
                   <ClassroomIcon /> {t.exportClassroom}
                 </button>
               </div>
             )}
           </div>
          
           {/* AUTH BUTTON */}
           {user ? (
             <div className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-3 py-1 border border-gray-200 whitespace-nowrap">
                {user.isAnonymous ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium px-2 hidden sm:inline">Guest</span>
                    <button 
                      onClick={() => setIsLoginModalOpen(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                    >
                      Login
                    </button>
                  </div>
                ) : (
                  <>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 bg-indigo-500 rounded-full text-white flex items-center justify-center text-xs">{user.email ? user.email[0] : (user.displayName ? user.displayName[0] : 'U')}</div>
                    )}
                    <button 
                      onClick={handleLogout} 
                      className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors whitespace-nowrap"
                    >
                      Logout
                    </button>
                  </>
                )}
             </div>
           ) : (
             <div className="text-xs text-gray-400 whitespace-nowrap">Loading...</div>
           )}

           {/* Voice Selector - Updated to be visible on mobile */}
           <div className="items-center bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200 flex">
             <span className="text-[10px] text-gray-500 font-bold mr-2 uppercase tracking-wide whitespace-nowrap">{t.voiceLabel}</span>
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
           
           {/* UI Language */}
           <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1.5 border border-gray-200 cursor-pointer hover:bg-gray-50 min-w-[70px] max-w-[120px]">
            <GlobeIcon />
            <select 
              value={uiLangCode}
              onChange={(e) => setUiLangCode(e.target.value)}
              className="bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer w-full text-ellipsis"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* --- LANGUAGE & MODE CONTROLS --- */}
      <div className="bg-white px-4 py-4 shadow-sm z-10 flex flex-col gap-3 shrink-0">
        <div className="flex gap-4">
          {/* Language Pair */}
          <div className="flex-1 flex items-center justify-between gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
             {/* Input Language */}
             <div className="flex-1 flex flex-col items-center min-w-0">
                <span className="text-[10px] text-gray-800 font-bold mb-1 whitespace-nowrap">{t.inputLang}</span>
                <div className="w-full relative px-2 py-1">
                   <select
                    value={langInput.code}
                    onChange={(e) => {
                      const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                      if (l) setLangInput(l);
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full z-10 cursor-pointer"
                   >
                     {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                   </select>
                   <div className="text-sm font-bold text-gray-900 truncate max-w-[120px] sm:max-w-xs text-center">
                      {langInput.flag} {langInput.name}
                   </div>
                </div>
             </div>
             
             <div className="text-gray-300 shrink-0"><ArrowRightIcon /></div>
  
             {/* Output Language */}
             <div className="flex-1 flex flex-col items-center min-w-0">
                <span className="text-[10px] text-gray-800 font-bold mb-1 whitespace-nowrap">{t.outputLang}</span>
                 <div className="w-full relative px-2 py-1">
                   <select
                    value={langOutput.code}
                    onChange={(e) => {
                      const l = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                      if (l) setLangOutput(l);
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full z-10 cursor-pointer"
                   >
                     {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                   </select>
                   <div className="text-sm font-bold text-gray-900 truncate max-w-[120px] sm:max-w-xs text-center">
                      {langOutput.flag} {langOutput.name}
                   </div>
                </div>
             </div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shrink-0">
             <button 
               onClick={() => setViewMode('both')}
               className={`px-3 rounded-xl text-xs font-bold transition-all ${viewMode === 'both' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Both
             </button>
             <button 
               onClick={() => setViewMode('output')}
               className={`px-3 rounded-xl text-xs font-bold transition-all ${viewMode === 'output' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Output
             </button>
          </div>
        </div>
      </div>

      {/* --- MAIN LIST AREA --- */}
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
             </div>
           )}

           <div className="flex flex-col gap-0.5">
             {history.map((item) => (
               <div key={item.id} className={`grid gap-1 items-stretch mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300 ${viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  
                  {/* Left Column: Original Text */}
                  {viewMode === 'both' && (
                    <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm text-gray-800 leading-relaxed text-sm h-fit">
                      {item.original}
                    </div>
                  )}

                  {/* Right Column: Translated Text */}
                  <div className={`relative p-3 rounded-xl shadow-sm transition-colors h-fit ${
                      item.isTranslating ? 'bg-gray-100 border border-gray-200' : 'bg-indigo-50 border border-indigo-100'
                    }`}>
                     {item.isTranslating && !item.translated ? (
                        <div className="flex gap-1 h-6 items-center">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                     ) : (
                       <div className="flex flex-row items-start gap-2">
                         <button 
                            onClick={() => playTTS(item.translated, item.id)}
                            className="shrink-0 p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-full transition-colors active:scale-95"
                         >
                           <SpeakerIcon />
                         </button>
                         <span className="text-indigo-900 font-medium leading-relaxed text-sm md:text-base whitespace-pre-wrap pt-0.5">{item.translated}</span>
                       </div>
                     )}
                  </div>
               </div>
             ))}

             {/* Live Transcription Placeholder */}
             {currentTurnText && (
               <div className={`grid gap-1 opacity-70 ${viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {viewMode === 'both' && (
                    <div className="bg-gray-50 border border-gray-300 border-dashed p-3 rounded-xl text-gray-600 italic animate-pulse text-sm">
                      {currentTurnText}
                    </div>
                  )}
                  {/* Show partial translation if we have it before completion, although mostly it comes after */}
                  <div className="flex items-center justify-center text-gray-300 text-sm italic">
                    ...
                  </div>
               </div>
             )}
           </div>

           <div className="h-20"></div> {/* Spacer for bottom bar */}
        </div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="bg-white px-6 py-4 rounded-t-[2rem] shadow-[0_-5px_20px_rgba(0,0,0,0.05)] flex items-center justify-between z-30 shrink-0 gap-4">
          
          <div className="flex items-center gap-2">
            {/* Scroll Lock Toggle */}
            <button 
               onClick={() => setIsAutoScroll(!isAutoScroll)}
               className={`flex flex-col items-center gap-1 transition-colors w-16 group`}
            >
               <div className={`p-3 rounded-full border transition-all ${isAutoScroll ? 'bg-indigo-100 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                 <div className="w-6 h-6 flex items-center justify-center rounded-full">
                    {isAutoScroll ? <ScrollDownIcon /> : <LockIcon />}
                 </div>
               </div>
               <span className={`text-[10px] font-bold ${isAutoScroll ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {isAutoScroll ? t.scrollAuto : t.scrollLock}
               </span>
            </button>

            {/* Play All */}
            <button 
              onClick={playAll}
              className="flex flex-col items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors w-16"
            >
              <div className="p-3 bg-gray-100 rounded-full">
                <PlayAllIcon />
              </div>
              <span className="text-[10px] font-bold">{t.playAll}</span>
            </button>
          </div>

          {/* Main Mic */}
          <button
            onClick={toggleMic}
            className={`w-20 h-20 -mt-10 rounded-full flex items-center justify-center shadow-xl border-4 border-white transition-all transform active:scale-95 ${
              status === ConnectionStatus.CONNECTED 
                ? 'bg-red-500 text-white shadow-red-200 ring-4 ring-red-50' 
                : 'bg-indigo-600 text-white shadow-indigo-200 ring-4 ring-indigo-50'
            }`}
          >
            {status === ConnectionStatus.CONNECTING ? (
               <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : status === ConnectionStatus.CONNECTED ? (
              <MicOffIcon />
            ) : (
              <MicIcon />
            )}
          </button>

          {/* Google Lens Link */}
          <button 
            onClick={openGoogleLens}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors w-16"
          >
             <div className="p-3 bg-gray-100 rounded-full">
               <LensIcon />
             </div>
             <span className="text-[10px] font-bold">{t.visionButton}</span>
          </button>
      </div>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6">
              <div className="text-center mb-6">
                 <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                 </div>
                 <h2 className="text-xl font-bold text-gray-800">{t.loginModalTitle}</h2>
              </div>
              
              <div className="space-y-3">
                 {/* Google Login Button */}
                 <button 
                    onClick={() => handleLoginSelection('google')}
                    className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50 transition-all group text-left relative overflow-hidden"
                 >
                    <div className="bg-white p-2 rounded-full shadow-sm mr-4 z-10">
                      <GoogleLogo />
                    </div>
                    <div className="z-10">
                       <h3 className="font-bold text-gray-800 group-hover:text-blue-700">{t.loginGoogle}</h3>
                       <p className="text-xs text-gray-500 mt-0.5">{t.loginGoogleDesc}</p>
                    </div>
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-100 rounded-xl pointer-events-none"></div>
                 </button>

                 {/* Guest Login Button */}
                 <button 
                    onClick={() => handleLoginSelection('guest')}
                    className="w-full flex items-center p-4 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group text-left"
                 >
                    <div className="bg-gray-200 p-2 rounded-full mr-4 text-gray-500 group-hover:bg-gray-300 group-hover:text-gray-700">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                       <h3 className="font-bold text-gray-700">{t.loginGuest}</h3>
                       <p className="text-xs text-gray-400 mt-0.5">{t.loginGuestDesc}</p>
                    </div>
                 </button>
              </div>

              <button 
                onClick={() => setIsLoginModalOpen(false)}
                className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Cancel
              </button>
           </div>
        </div>
      )}

      {/* --- CLASSROOM MODAL --- */}
      {isClassroomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <ClassroomIcon /> {t.selectCourse}
                 </h2>
                 <button 
                   onClick={() => setIsClassroomModalOpen(false)}
                   className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm"
                 >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              
              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4">
                 {isLoadingCourses ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                       <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-3"></div>
                       <p className="text-sm">{t.fetchingCourses}</p>
                    </div>
                 ) : courses.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                       <p>{t.noCourses}</p>
                    </div>
                 ) : (
                    <div className="space-y-2">
                       {courses.map((course) => (
                          <button 
                             key={course.id}
                             onClick={() => handleSubmitCourseWork(course.id)}
                             disabled={isExporting}
                             className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
                          >
                             <div>
                                <h3 className="font-bold text-gray-800 group-hover:text-indigo-700">{course.name}</h3>
                                <p className="text-xs text-gray-500">{course.section}</p>
                             </div>
                             {isExporting ? (
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div>
                             ) : (
                                <div className="text-gray-300 group-hover:text-indigo-500"><ArrowRightIcon /></div>
                             )}
                          </button>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}