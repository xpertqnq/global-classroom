import React from 'react';
import { ClassroomIcon, ArrowRightIcon } from './Icons';

interface ClassroomModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: any;
    courses: any[];
    isLoadingCourses: boolean;
    isExporting: boolean;
    onSubmit: (courseId: string) => void;
}

const ClassroomModal: React.FC<ClassroomModalProps> = ({
    isOpen,
    onClose,
    t,
    courses,
    isLoadingCourses,
    isExporting,
    onSubmit,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ClassroomIcon /> {t.selectCourse}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-indigo-600 p-1 bg-white rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
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
                                    onClick={() => onSubmit(course.id)}
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
    );
};

export default ClassroomModal;
