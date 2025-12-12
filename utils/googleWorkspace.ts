import { ConversationItem } from '../types';
import { base64ToUint8Array } from './audioUtils';

// --- Helpers ---

const getHeaders = (accessToken: string, contentType: string = 'application/json') => {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': contentType,
  };
};

// --- Local Offline Export Helpers ---

export const downloadTranscriptLocally = (history: ConversationItem[]) => {
  const today = new Date().toISOString().split('T')[0];
  let contentString = `Global Classroom - Translation Notes\nDate: ${today}\n\n`;

  history.forEach(item => {
    contentString += `[${new Date(item.timestamp).toLocaleTimeString()}]\n`;
    contentString += `Original: ${item.original}\n`;
    contentString += `Translated: ${item.translated}\n`;
    contentString += `----------------------------------------\n`;
  });

  const blob = new Blob([contentString], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `GlobalClassroom_Transcript_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  return { success: true, local: true };
};

export const downloadBackupLocally = (history: ConversationItem[]) => {
  const backupData = {
    date: new Date().toISOString(),
    app: "Global Classroom",
    history: history.map(({ audioBase64, ...rest }) => rest) 
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `GlobalClassroom_Backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, local: true };
};

// --- Drive API ---

const findOrCreateFolder = async (name: string, accessToken: string, parentId?: string): Promise<string> => {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
    headers: getHeaders(accessToken)
  });
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const metaData: any = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metaData.parents = [parentId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(metaData)
  });
  const createData = await createRes.json();
  return createData.id;
};

const uploadFile = async (name: string, mimeType: string, data: Blob, accessToken: string, parentId: string) => {
  const metadata = {
    name: name,
    parents: [parentId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', data);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: form
  });
  
  return await res.json();
};

export const backupToDrive = async (accessToken: string, history: ConversationItem[]) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rootId = await findOrCreateFolder("Global Classroom", accessToken);
    const dateFolderId = await findOrCreateFolder(today, accessToken, rootId);

    let textContent = "Global Classroom - Translation Log\n";
    textContent += `Date: ${today}\n\n`;
    history.forEach((item) => {
      textContent += `[${new Date(item.timestamp).toLocaleTimeString()}]\n`;
      textContent += `Original: ${item.original}\n`;
      textContent += `Translated: ${item.translated}\n\n`;
    });
    
    const textBlob = new Blob([textContent], { type: 'text/plain' });
    await uploadFile(`Transcript_${Date.now()}.txt`, 'text/plain', textBlob, accessToken, dateFolderId);

    return { success: true, message: "Backup complete." };

  } catch (error) {
    console.error("Drive Backup Error", error);
    throw error;
  }
};

// --- Docs API ---

export const exportToDocs = async (accessToken: string, history: ConversationItem[]) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const title = `Global Classroom Notes - ${today}`;

    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({ title: title })
    });
    const docData = await createRes.json();
    const docId = docData.documentId;

    let contentString = "";
    history.forEach(item => {
      contentString += `Time: ${new Date(item.timestamp).toLocaleTimeString()}\n`;
      contentString += `Original: ${item.original}\n`;
      contentString += `Translation: ${item.translated}\n`;
      contentString += `----------------------------------------\n`;
    });

    const finalBody = `Translation Notes - ${today}\n\n${contentString}`;

    await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        requests: [
            {
                insertText: {
                    location: { index: 1 },
                    text: finalBody
                }
            }
        ]
      })
    });

    return { success: true, docId: docId, message: "Document created successfully." };

  } catch (error) {
    console.error("Docs Export Error", error);
    throw error;
  }
};

// --- Classroom API ---

export const listCourses = async (accessToken: string) => {
  const res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
    headers: getHeaders(accessToken)
  });
  if (!res.ok) throw new Error('Failed to fetch courses');
  const data = await res.json();
  return data.courses || [];
};

export const createCourseWork = async (accessToken: string, courseId: string, history: ConversationItem[]) => {
  const today = new Date().toISOString().split('T')[0];
  let description = "Automatic translation notes from Global Classroom.\n\n";
  history.slice(0, 10).forEach(item => { // Preview only
    description += `${item.original} -> ${item.translated}\n`;
  });
  description += "\n(See attached or full transcript)";

  // Note: Creating a full text file and attaching it requires Drive upload then linking.
  // For simplicity in this demo, we create a 'Text' based assignment or Link.
  
  const body = {
    title: `Translation Notes ${today}`,
    description: description,
    workType: "ASSIGNMENT",
    state: "PUBLISHED",
  };

  const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(body)
  });
  
  if (!res.ok) throw new Error('Failed to create coursework');
  return await res.json();
};