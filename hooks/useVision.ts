import { useState, useRef, useCallback } from 'react';
import { VisionNotification, VisionResult, Language } from '../types';

interface UseVisionProps {
    postApi: <T>(endpoint: string, body: any) => Promise<T>;
    langInput: Language;
    langOutput: Language;
    MODEL_VISION: string;
}

export function useVision({ postApi, langInput, langOutput, MODEL_VISION }: UseVisionProps) {
    const [visionNotifications, setVisionNotifications] = useState<VisionNotification[]>([]);
    const [activeVisionNotificationId, setActiveVisionNotificationId] = useState<string | null>(null);
    const [visionToastIds, setVisionToastIds] = useState<string[]>([]);
    const toastTimeoutsRef = useRef<Record<string, number>>({});

    const enqueueVisionToast = useCallback((id: string) => {
        setVisionToastIds(prev => [id, ...prev].slice(0, 3));
        if (toastTimeoutsRef.current[id]) window.clearTimeout(toastTimeoutsRef.current[id]);
        toastTimeoutsRef.current[id] = window.setTimeout(() => {
            setVisionToastIds(prev => prev.filter(x => x !== id));
            delete toastTimeoutsRef.current[id];
        }, 7000);
    }, []);

    const dismissVisionToast = useCallback((id: string) => {
        setVisionToastIds(prev => prev.filter(x => x !== id));
        if (toastTimeoutsRef.current[id]) {
            window.clearTimeout(toastTimeoutsRef.current[id]);
            delete toastTimeoutsRef.current[id];
        }
    }, []);

    const openVisionNotification = useCallback((id: string) => {
        setActiveVisionNotificationId(id);
        setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        dismissVisionToast(id);
    }, [dismissVisionToast]);

    const handleVisionCaptured = async (payload: { blob: Blob }) => {
        const id = `vision_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const langA = langInput.code;
        const langB = langOutput.code;
        const item: VisionNotification = { id, timestamp: Date.now(), status: 'processing', isRead: false };
        setVisionNotifications(prev => [item, ...prev]);
        try {
            const base64Image = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
                reader.onerror = reject;
                reader.readAsDataURL(payload.blob);
            });
            const result = await postApi<VisionResult>('vision', { base64Image, langA, langB, model: MODEL_VISION });
            setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'done', result } : n));
            enqueueVisionToast(id);
        } catch (e) {
            setVisionNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'error', error: String(e) } : n));
            enqueueVisionToast(id);
        }
    };

    return {
        visionNotifications,
        setVisionNotifications,
        activeVisionNotificationId,
        setActiveVisionNotificationId,
        visionToastIds,
        handleVisionCaptured,
        openVisionNotification,
        dismissVisionToast
    };
}
