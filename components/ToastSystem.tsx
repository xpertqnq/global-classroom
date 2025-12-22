import React from 'react';
import { Toast } from '../hooks/useToast';

interface ToastSystemProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

const ToastSystem: React.FC<ToastSystemProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-auto max-w-[90vw]">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center justify-between gap-4 min-w-[280px] ${toast.type === 'success' ? 'bg-emerald-50/90 border-emerald-100 text-emerald-800' :
                            toast.type === 'error' ? 'bg-red-50/90 border-red-100 text-red-800' :
                                toast.type === 'warning' ? 'bg-orange-50/90 border-orange-100 text-orange-800' :
                                    'bg-white/90 border-gray-100 text-gray-800'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        {toast.type === 'success' && (
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {toast.type === 'error' && (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <p className="text-sm font-bold leading-tight">{toast.message}</p>
                    </div>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastSystem;
