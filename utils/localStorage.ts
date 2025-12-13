import { ConversationItem } from '../types';

const HISTORY_KEY = 'global_classroom_history';
const SESSIONS_KEY = 'global_classroom_sessions';

export interface Session {
  id: string;
  date: number;
  preview: string;
  items: ConversationItem[];
}

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
    // Save current active history
    const itemsToSave = history.map(item => {
      const { audioBase64, ...metaData } = item;
      return metaData;
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(itemsToSave));
  } catch (e) {
    console.error("Failed to save history to local storage", e);
  }
};

export const loadSessions = (): Session[] => {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveSession = (session: Session) => {
  try {
    const sessions = loadSessions();
    // Optimize items before saving to session storage
    const optimizedItems = session.items.map(item => {
       const { audioBase64, ...metaData } = item;
       return metaData;
    });
    
    const sessionToSave = { ...session, items: optimizedItems };
    
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = sessionToSave;
    } else {
      sessions.unshift(sessionToSave);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const deleteSession = (id: string) => {
   try {
     const sessions = loadSessions().filter(s => s.id !== id);
     localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
     return sessions;
   } catch (e) { return []; }
};

export const clearHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error("Failed to clear local history", e);
  }
};