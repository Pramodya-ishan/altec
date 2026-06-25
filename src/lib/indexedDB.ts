// src/lib/indexedDB.ts
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('videostore', 3);
    request.onupgradeneeded = (e: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos');
      }
      if (!db.objectStoreNames.contains('skips')) {
        db.createObjectStore('skips');
      }
      if (!db.objectStoreNames.contains('ai_chats')) {
        db.createObjectStore('ai_chats');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveAIChats = async (chats: any[]): Promise<boolean> => {
   const db = await initDB();
   return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_chats', 'readwrite');
      const store = tx.objectStore('ai_chats');
      store.put(chats, 'global_chats');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
   });
};

export const getAIChats = async (): Promise<any[] | undefined> => {
   const db = await initDB();
   return new Promise((resolve, reject) => {
      const tx = db.transaction('ai_chats', 'readonly');
      const store = tx.objectStore('ai_chats');
      const req = store.get('global_chats');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
   });
};

export const saveVideoFile = async (id: string, file: Blob): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    store.put(file, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteVideoFile = async (id: string): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllVideoFiles = async (): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    store.clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllVideoKeys = async (): Promise<string[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
};

export const getVideoFile = async (id: string): Promise<Blob | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const saveSkipData = async (title: string, data: any): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('skips', 'readwrite');
    const store = tx.objectStore('skips');
    store.put(data, title);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getSkipData = async (title: string): Promise<any | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('skips', 'readonly');
    const store = tx.objectStore('skips');
    const req = store.get(title);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};
