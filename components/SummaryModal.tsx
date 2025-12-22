import React from 'react';
import { TranslationMap } from '../types';

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summaryText: string;
    isSummarizing: boolean;
    t: TranslationMap;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summaryText, isSummarizing, t }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all text-white"
                    >
                        ✕
                    </button>
                    <h2 className="text-xl font-black flex items-center gap-2">
                        ✨ {t.summaryTitle || '대화 요약 리포트'}
                    </h2>
                    <p className="text-white/80 text-xs mt-1 font-medium">AI가 분석한 핵심 내용입니다.</p>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto bg-slate-50">
                    {isSummarizing ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-gray-400 animate-pulse">AI가 대화를 분석 중입니다...</p>
                        </div>
                    ) : summaryText ? (
                        <div className="prose prose-slate max-w-none">
                            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm font-medium">
                                {summaryText}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400 font-bold">
                            분석할 대화 내용이 충분하지 않습니다.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-full text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        {t.close || '닫기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SummaryModal;
