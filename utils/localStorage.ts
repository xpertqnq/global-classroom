import { ConversationItem } from '../types';

const HISTORY_KEY = 'global_classroom_history';

export const loadHistory = (): ConversationItem[] => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load history from local storage", e);
    return [];
  }
};

export const saveHistory = (history: ConversationItem[]) => {
  try {
    // Create a version of history without the heavy audioBase64 data
    // We only store the metadata and text to avoid hitting localStorage quotas (usually 5MB)
    const itemsToSave = history.map(item => {
      // Destructure to separate audio data
      const { audioBase64, ...metaData } = item;
      return metaData;
    });
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(itemsToSave));
  } catch (e) {
    console.error("Failed to save history to local storage", e);
  }
};

export const clearHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error("Failed to clear local history", e);
  }
};
