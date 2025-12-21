import React from 'react';
import { AppSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    t: any;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, setSettings, t }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        설정
                    </h2>

                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-indigo-600 p-1 bg-white rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <div className="text-sm font-bold text-gray-800">Drive 백업 방식</div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSettings(prev => ({ ...prev, driveBackupMode: 'manual' }))}
                                className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 shadow-sm ${settings.driveBackupMode === 'manual'
                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                                    }`}
                            >
                                수동
                            </button>
                            <button
                                onClick={() => setSettings(prev => ({ ...prev, driveBackupMode: 'auto' }))}
                                className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 shadow-sm ${settings.driveBackupMode === 'auto'
                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100'
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                                    }`}
                            >
                                자동
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-bold text-gray-800">음성 캐시(IndexedDB)</div>
                        <button
                            onClick={() => setSettings(prev => ({ ...prev, audioCacheEnabled: !prev.audioCacheEnabled }))}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-[0.98] shadow-sm ${settings.audioCacheEnabled
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                                }`}
                        >
                            <span className="text-sm font-bold">사용</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${settings.audioCacheEnabled ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>{settings.audioCacheEnabled ? 'ON' : 'OFF'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
