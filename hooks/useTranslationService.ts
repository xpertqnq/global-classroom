import React, { useCallback } from 'react';
import { Language, ConversationItem, AppSettings } from '../types';

interface UseTranslationServiceProps {
    settings: AppSettings;
    setHistory: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
    isAutoPlay: boolean;
    playTTS: (text: string, id: string) => void;
    MODEL_TRANSLATE: string;
}

export function useTranslationService({
    settings,
    setHistory,
    isAutoPlay,
    playTTS,
    MODEL_TRANSLATE
}: UseTranslationServiceProps) {
    const postApi = useCallback(async <T,>(endpoint: string, body: any): Promise<T> => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (settings.userApiKey) {
            headers["x-user-api-key"] = settings.userApiKey;
        }
        const resp = await fetch(`/api/${endpoint}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`API Error: ${resp.statusText}`);
        return resp.json();
    }, [settings.userApiKey]);

    const translateText = async (text: string, id: string, fromLang: Language, toLang: Language) => {
        try {
            const data = await postApi<{ translated: string }>('translate', {
                text,
                from: fromLang.name,
                to: toLang.name,
                model: MODEL_TRANSLATE,
            });
            const translated = data.translated?.trim() || "";
            setHistory(prev => prev.map(item =>
                item.id === id ? { ...item, translated: translated, isTranslating: false } : item
            ));
            if (isAutoPlay && translated) {
                playTTS(translated, id);
            }
        } catch (e) {
            console.error("Translation failed", e);
            setHistory(prev => prev.map(item =>
                item.id === id ? { ...item, translated: "Error", isTranslating: false } : item
            ));
        }
    };

    return {
        postApi,
        translateText
    };
}
