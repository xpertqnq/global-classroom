import React from 'react';
import { DocsIcon, DriveIcon, ClassroomIcon, NotebookLMIcon } from './Icons';

interface ExportMenuProps {
    isOpen: boolean;
    menuRef: React.RefObject<HTMLDivElement>;
    onExport: (type: 'docs' | 'drive' | 'classroom' | 'notebooklm') => void;
    t: any;
}

export default function ExportMenu({ isOpen, menuRef, onExport, t }: ExportMenuProps) {
    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed top-28 right-6 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 py-3 z-[100] animate-in fade-in slide-in-from-top-4 duration-200"
        >
            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t.exportMenu}</h3>
            </div>
            <button
                onClick={() => onExport('docs')}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <DocsIcon />
                <span className="text-sm font-bold text-gray-700">{t.exportDocs}</span>
            </button>
            <button
                onClick={() => onExport('drive')}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <DriveIcon />
                <span className="text-sm font-bold text-gray-700">{t.exportDrive}</span>
            </button>
            <button
                onClick={() => onExport('classroom')}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <ClassroomIcon />
                <span className="text-sm font-bold text-gray-700">{t.exportClassroom}</span>
            </button>
            <button
                onClick={() => onExport('notebooklm')}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-50 mt-1"
            >
                <NotebookLMIcon />
                <span className="text-sm font-bold text-gray-700">{t.exportNotebookLM}</span>
            </button>
        </div>
    );
}
