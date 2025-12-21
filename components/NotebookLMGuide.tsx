import React from 'react';

type NotebookLMGuideProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function NotebookLMGuide({ isOpen, onClose }: NotebookLMGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-blue-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Google NotebookLM 연동 가이드</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-indigo-600 p-1 bg-white rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900 border-l-4 border-blue-500 pl-3">NotebookLM이란?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Google NotebookLM은 여러분의 노트를 인공지능이 학습하여 질문에 답변하거나, 요약본 또는 팟캐스트 형태의 오디오 개요를 만들어주는 강력한 AI 도구입니다.
            </p>
          </section>

          <section className="space-y-6">
            <h3 className="font-bold text-gray-900 border-l-4 border-blue-500 pl-3">연동 단계 (3단계)</h3>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">1</div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">데이터 내보내기</h4>
                  <p className="text-sm text-gray-600">현재 앱의 상단 [내보내기] 메뉴에서 <strong>Google Drive</strong> 또는 <strong>Google Docs</strong>를 선택하여 저장하세요.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">2</div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">NotebookLM 접속</h4>
                  <p className="text-sm text-gray-600 mb-2">Google NotebookLM 사이트에 접속하세요.</p>
                  <a
                    href="https://notebooklm.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                  >
                    notebooklm.google.com 열기
                    <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">3</div>
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">소스 업로드</h4>
                  <p className="text-sm text-gray-600">노트북 생성 후 <strong>[소스 추가]</strong> 버튼을 누르고 <strong>'Google Drive'</strong>를 선택하여 방금 내보낸 파일을 선택하면 끝!</p>
                </div>
              </div>
            </div>
          </section>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                <strong>팁:</strong> 'Google Drive' 내보내기 시 생성되는 `transcript.txt` 파일을 소스로 사용하면 가장 깨끗한 텍스트로 학습이 가능합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}
