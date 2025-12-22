import React, { useCallback } from 'react';
import { ConversationItem, VoiceOption, AppSettings } from '../types';
import { getCachedAudioBase64, setCachedAudioBase64 } from '../utils/idbAudioCache';
import { base64ToUint8Array, arrayBufferToBase64 } from '../utils/audioUtils';
import { mergeAudioBlobs } from '../utils/audioMixer';

interface UseAudioPlayerProps {
    history: ConversationItem[];
    setHistory: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
    selectedVoice: VoiceOption;
    settings: AppSettings;
    postApi: <T>(endpoint: string, body: any) => Promise<T>;
    playPCM: (base64: string) => Promise<void>;
    MODEL_TTS: string;
    t: any;
}

export function useAudioPlayer({
    history,
    setHistory,
    selectedVoice,
    settings,
    postApi,
    playPCM,
    MODEL_TTS,
    t
}: UseAudioPlayerProps) {
    const splitTextForTts = (text: string, maxLen: number): string[] => {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized || normalized.length <= maxLen) return normalized ? [normalized] : [];
        const separators = new Set(['.', '!', '?', '。', '！', '？', '\n']);
        const sentences: string[] = [];
        let current = '';
        for (let i = 0; i < normalized.length; i++) {
            const ch = normalized[i];
            current += ch;
            if (separators.has(ch)) {
                const s = current.trim();
                if (s) sentences.push(s);
                current = '';
            }
        }
        if (current.trim()) sentences.push(current.trim());
        const chunks: string[] = [];
        let buf = '';
        for (const s of sentences) {
            if (!buf) {
                if (s.length <= maxLen) buf = s;
                else {
                    for (let i = 0; i < s.length; i += maxLen) {
                        const part = s.slice(i, i + maxLen).trim();
                        if (part) chunks.push(part);
                    }
                }
                continue;
            }
            const next = `${buf} ${s}`;
            if (next.length <= maxLen) buf = next;
            else {
                chunks.push(buf);
                if (s.length <= maxLen) buf = s;
                else {
                    for (let i = 0; i < s.length; i += maxLen) {
                        const part = s.slice(i, i + maxLen).trim();
                        if (part) chunks.push(part);
                    }
                    buf = '';
                }
            }
        }
        if (buf) chunks.push(buf);
        return chunks;
    };

    const playTTS = async (text: string, id?: string, notifyOnErrorValue: boolean = false): Promise<void> => {
        const normalized = String(text || '').trim();
        if (!normalized) return;
        const cacheKey = id ? `${id}:${selectedVoice.name}:${MODEL_TTS}` : null;
        if (id) {
            const item = history.find(i => i.id === id);
            if (item?.audioBase64) return playPCM(item.audioBase64);
        }
        if (id && cacheKey && settings.audioCacheEnabled) {
            const cached = await getCachedAudioBase64(cacheKey);
            if (cached) {
                setHistory(prev => prev.map(item => item.id === id ? { ...item, audioBase64: cached } : item));
                return playPCM(cached);
            }
        }
        const chunks = splitTextForTts(normalized, 200);
        try {
            const pcmChunks: Uint8Array[] = [];
            for (const chunk of chunks) {
                const data = await postApi<{ audioBase64: string }>('tts', {
                    text: chunk,
                    voiceName: selectedVoice.name,
                    model: MODEL_TTS,
                });
                if (data.audioBase64) {
                    pcmChunks.push(base64ToUint8Array(data.audioBase64));
                    await playPCM(data.audioBase64);
                }
            }
            if (id && pcmChunks.length > 0) {
                const totalLen = pcmChunks.reduce((sum, x) => sum + x.byteLength, 0);
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const x of pcmChunks) { merged.set(x, offset); offset += x.byteLength; }
                const mergedBase64 = arrayBufferToBase64(merged.buffer);
                setHistory(prev => prev.map(item => item.id === id ? { ...item, audioBase64: mergedBase64 } : item));
                if (cacheKey && settings.audioCacheEnabled) await setCachedAudioBase64(cacheKey, mergedBase64);
            }
        } catch (e) {
            console.error("TTS failed", e);
            if (notifyOnErrorValue) alert(`TTS 실패: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const playAll = async () => {
        for (const item of history) {
            if (item.translated) {
                await playTTS(item.translated, item.id);
                await new Promise(r => setTimeout(r, 500));
            }
        }
    };

    const handleDownloadSessionAudio = async (sessionItems: ConversationItem[], sessionTitle: string) => {
        try {
            const audioItems = sessionItems.filter(item => item.audioBase64);
            if (audioItems.length === 0) {
                alert(t.noAudioToExport || "재생 가능한 오디오가 없습니다.");
                return;
            }

            const blobs = audioItems.map(item => {
                const bytes = base64ToUint8Array(item.audioBase64!);
                return new Blob([bytes.buffer as any], { type: 'audio/wav' });
            });

            const mergedBlob = await mergeAudioBlobs(blobs);
            const url = URL.createObjectURL(mergedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sessionTitle || 'session'}_audio.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Audio export failed", e);
            alert("Audio export failed");
        }
    };

    return {
        playTTS,
        playAll,
        handleDownloadSessionAudio
    };
}
