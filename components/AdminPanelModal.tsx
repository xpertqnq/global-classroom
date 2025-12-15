import React, { useMemo, useState } from 'react';
import { listDriveSessions, listCourses } from '../utils/googleWorkspace';
import { clearCachedAudio, getCachedAudioBase64, setCachedAudioBase64 } from '../utils/idbAudioCache';

type AdminPanelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
  accessToken: string | null;
  sessionsCount: number;
  historyCount: number;
};

const SAMPLE_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfA//Z';

export default function AdminPanelModal({
  isOpen,
  onClose,
  user,
  accessToken,
  sessionsCount,
  historyCount,
}: AdminPanelModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const userEmail = useMemo(() => {
    if (!user) return '';
    if (typeof user.email === 'string') return user.email;
    return '';
  }, [user]);

  const appendLog = (line: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()} | ${line}`, ...prev].slice(0, 200));
  };

  const postApi = async <T,>(path: string, payload: unknown): Promise<T> => {
    const res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMessage = (json as any)?.error || '요청에 실패했습니다.';
      const detailMessage = (json as any)?.detail;
      throw new Error(detailMessage ? `${errorMessage} (${detailMessage})` : errorMessage);
    }
    return json as T;
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    if (isRunning) return;
    setIsRunning(true);
    appendLog(`시작: ${label}`);
    try {
      await fn();
      appendLog(`성공: ${label}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`실패: ${label} - ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">관리자 모드</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6" role="dialog" aria-label="관리자 모드">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-500 mb-2">인증 상태</div>
              <div className="text-sm text-gray-800">
                <div className="truncate">이메일: <span className="font-bold">{userEmail || '-'}</span></div>
                <div className="truncate">Google 토큰: <span className="font-bold">{accessToken ? '있음' : '없음'}</span></div>
                <div className="truncate">로컬 세션: <span className="font-bold">{sessionsCount}</span></div>
                <div className="truncate">대화 아이템: <span className="font-bold">{historyCount}</span></div>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-500 mb-2">저장소/캐시 테스트</div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isRunning}
                  onClick={() =>
                    run('IDB 캐시 set/get/clear', async () => {
                      const key = `admin_cache_test_${Date.now()}`;
                      await setCachedAudioBase64(key, 'AAECAwQ=');
                      const val = await getCachedAudioBase64(key);
                      appendLog(`캐시 조회: ${val ? '성공' : '실패'}`);
                      await clearCachedAudio();
                    })
                  }
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  캐시 테스트
                </button>
                <button
                  disabled={isRunning}
                  onClick={() => run('페이지 새로고침', async () => window.location.reload())}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  새로고침
                </button>
              </div>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-500 mb-3">Netlify Functions API 테스트</div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isRunning}
                onClick={() =>
                  run('live-token', async () => {
                    const data = await postApi<{ token: string; expireTime?: string }>('live-token', {});
                    appendLog(`live-token: ${data.token ? '토큰 발급 OK' : '토큰 없음'}`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                live-token
              </button>
              <button
                disabled={isRunning}
                onClick={() =>
                  run('translate', async () => {
                    const data = await postApi<{ translated: string }>('translate', {
                      text: 'Hello, how are you?',
                      from: 'English',
                      to: 'Korean',
                      model: 'gemini-2.5-flash',
                    });
                    appendLog(`translate: ${String(data.translated || '').slice(0, 60)}`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                translate
              </button>
              <button
                disabled={isRunning}
                onClick={() =>
                  run('detect-language', async () => {
                    const data = await postApi<{ code: string; confidence: number }>('detect-language', { text: '안녕하세요. 반갑습니다.' });
                    appendLog(`detect-language: ${data.code} (${data.confidence})`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                detect-language
              </button>
              <button
                disabled={isRunning}
                onClick={() =>
                  run('tts', async () => {
                    const data = await postApi<{ audioBase64: string }>('tts', {
                      text: '관리자 모드 TTS 테스트입니다.',
                      voiceName: 'Kore',
                      model: 'gemini-2.5-flash-preview-tts',
                    });
                    appendLog(`tts: audioBase64 ${data.audioBase64 ? 'OK' : 'EMPTY'}`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                tts
              </button>
              <button
                disabled={isRunning}
                onClick={() =>
                  run('vision', async () => {
                    const data = await postApi<{ originalText: string; translatedText: string }>('vision', {
                      base64Image: SAMPLE_JPEG_BASE64,
                      langA: 'ko',
                      langB: 'en',
                      model: 'gemini-2.5-flash',
                    });
                    appendLog(`vision: 원문 ${String(data.originalText || '').slice(0, 40)}`);
                    appendLog(`vision: 번역 ${String(data.translatedText || '').slice(0, 40)}`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                vision
              </button>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-500 mb-3">Google 기능 테스트(토큰 필요)</div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isRunning || !accessToken}
                onClick={() =>
                  run('Drive 세션 목록', async () => {
                    const list = await listDriveSessions(accessToken!, 5);
                    appendLog(`Drive 세션: ${list.length}개`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                Drive 세션
              </button>
              <button
                disabled={isRunning || !accessToken}
                onClick={() =>
                  run('Classroom 수업 목록', async () => {
                    const list = await listCourses(accessToken!);
                    appendLog(`Classroom 수업: ${Array.isArray(list) ? list.length : 0}개`);
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                Classroom 수업
              </button>
              {!accessToken && (
                <div className="text-xs text-gray-400 self-center">Google 로그인이 필요합니다.</div>
              )}
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-500 mb-2">로그</div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {logs.length === 0 ? '아직 실행한 항목이 없습니다.' : logs.join('\n')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
