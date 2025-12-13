import { Language, TranslationMap, VoiceOption } from './types';

// Updated with the provided Google Cloud OAuth 2.0 Client ID
export const GOOGLE_CLIENT_ID = "638001008834-uplge5n42qbdqhvm1f8sqn7sfd6fb7.apps.googleusercontent.com"; 

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'ko', name: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'th', name: 'ภาษาไทย (Thai)', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indo', flag: '🇮🇩' },
  { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'mn', name: 'Монгол (Mongolian)', flag: '🇲🇳' },
  { code: 'uz', name: 'Oʻzbek (Uzbek)', flag: '🇺🇿' },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  { name: 'Kore', label: 'Kore', gender: 'Female', style: 'Calm' },
  { name: 'Puck', label: 'Puck', gender: 'Male', style: 'Deep' },
  { name: 'Charon', label: 'Charon', gender: 'Male', style: 'Authoritative' },
  { name: 'Fenrir', label: 'Fenrir', gender: 'Male', style: 'Resonant' },
  { name: 'Zephyr', label: 'Zephyr', gender: 'Female', style: 'Energetic' },
];

export const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';
export const MODEL_TRANSLATE = 'gemini-2.5-flash'; 
export const MODEL_VISION = 'gemini-2.5-flash'; 
export const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const TRANSLATIONS: Record<string, TranslationMap & { scrollAuto: string; scrollLock: string; openLens: string }> = {
  ko: {
    appTitle: "Global Class",
    subtitle: "실시간 AI 통역 노트",
    inputLang: "입력 언어",
    outputLang: "출력 언어",
    autoPlay: "자동 읽기",
    playAll: "전체 듣기",
    statusListening: "듣는 중...",
    statusStandby: "시작하려면 터치",
    connectionError: "연결 오류",
    retry: "재시도",
    connecting: "연결 중...",
    visionButton: "Google 렌즈",
    visionTitle: "칠판/노트 번역",
    visionDetected: "감지된 텍스트",
    visionTranslated: "번역 결과",
    visionRetake: "다시 찍기",
    visionAnalyzing: "분석 중...",
    visionNoText: "텍스트 없음",
    visionFail: "실패",
    visionError: "오류",
    voiceLabel: "목소리 설정",
    emptyHint: "마이크를 켜고 말씀을 시작하세요.\n실시간으로 적고 번역해 드립니다.",
    exportMenu: "내보내기",
    exportDocs: "Google Docs 저장",
    exportDrive: "Google Drive 백업",
    exportClassroom: "Classroom 제출",
    loginRequired: "Google 로그인이 필요합니다.",
    loginRequiredDrive: "Drive 백업은 로그인이 필요합니다.",
    loginRequiredClassroom: "Classroom 제출은 로그인이 필요합니다.",
    loginUnavailable: "로그인 불가 (도메인 설정 확인)",
    offlineMode: "비로그인 상태: 텍스트 파일로 다운로드합니다.",
    exporting: "처리 중...",
    exportSuccess: "완료되었습니다!",
    selectCourse: "수업 선택",
    fetchingCourses: "수업 목록 불러오는 중...",
    noCourses: "참여 중인 수업이 없습니다.",
    submitTo: "제출하기",
    loginModalTitle: "로그인 방법 선택",
    loginGoogle: "Google로 로그인",
    loginGoogleDesc: "Classroom, Docs, Drive 기능을 사용합니다.",
    loginGuest: "게스트로 계속하기",
    loginGuestDesc: "기록을 기기에만 저장합니다.",
    scrollAuto: "자동 스크롤",
    scrollLock: "스크롤 고정",
    openLens: "Google 렌즈 실행",
  },
  en: {
    appTitle: "Global Class",
    subtitle: "AI Live Interpreter",
    inputLang: "Input",
    outputLang: "Output",
    autoPlay: "Auto Read",
    playAll: "Play All",
    statusListening: "Listening...",
    statusStandby: "Tap to Start",
    connectionError: "Error",
    retry: "Retry",
    connecting: "Connecting...",
    visionButton: "Google Lens",
    visionTitle: "Board Translation",
    visionDetected: "Detected",
    visionTranslated: "Translation",
    visionRetake: "Retake",
    visionAnalyzing: "Analyzing...",
    visionNoText: "No text",
    visionFail: "Failed",
    visionError: "Error",
    voiceLabel: "Voice",
    emptyHint: "Turn on the mic and start speaking.\nWe will transcribe and translate in real-time.",
    exportMenu: "Export",
    exportDocs: "Save to Google Docs",
    exportDrive: "Backup to Drive",
    exportClassroom: "Submit to Classroom",
    loginRequired: "Google Login Required",
    loginRequiredDrive: "Login required for Drive backup.",
    loginRequiredClassroom: "Login required for Classroom submission.",
    loginUnavailable: "Login Unavailable (Domain Error)",
    offlineMode: "Logged out: Downloading as text file.",
    exporting: "Processing...",
    exportSuccess: "Done!",
    selectCourse: "Select Class",
    fetchingCourses: "Fetching classes...",
    noCourses: "No classes found.",
    submitTo: "Submit",
    loginModalTitle: "Choose Login Method",
    loginGoogle: "Sign in with Google",
    loginGoogleDesc: "Enable Classroom, Docs, and Drive features.",
    loginGuest: "Continue as Guest",
    loginGuestDesc: "Save transcripts locally only.",
    scrollAuto: "Auto Scroll",
    scrollLock: "Scroll Lock",
    openLens: "Open Lens",
  },
};

const DEFAULT_TRANS = TRANSLATIONS['en'];
// Fallback for other languages
['ja', 'zh', 'vi', 'es', 'fr', 'de', 'ru', 'th', 'id', 'ar', 'hi', 'tl', 'mn', 'uz'].forEach(code => {
  if (!TRANSLATIONS[code]) TRANSLATIONS[code] = DEFAULT_TRANS;
});