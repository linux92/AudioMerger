// storageUtils.js — Robust IndexedDB persistence for audio files and timeline clips

const DB_NAME = 'AudioMergerDB';
const DB_VERSION = 1;
const STORE_FILES = 'audio_files';
const STORE_META = 'project_meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves all imported audio files (as Blobs) and project metadata to IndexedDB.
 */
export async function saveProjectToStorage({ audioFiles, clips, gapSeconds, script, selectedFileId }) {
  try {
    const db = await openDB();

    // 1. Save Audio File Blobs
    const txFiles = db.transaction(STORE_FILES, 'readwrite');
    const filesStore = txFiles.objectStore(STORE_FILES);

    // Clear existing files that are no longer in audioFiles
    const existingKeys = await new Promise((res) => {
      const req = filesStore.getAllKeys();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    const currentIds = new Set(audioFiles.map((af) => af.id));
    for (const key of existingKeys) {
      if (!currentIds.has(key)) {
        filesStore.delete(key);
      }
    }

    for (const af of audioFiles) {
      if (af.file) {
        filesStore.put({
          id: af.id,
          name: af.file.name,
          type: af.file.type || 'audio/wav',
          blob: af.file, // File inherits from Blob
          lastModified: af.file.lastModified || Date.now(),
        });
      }
    }

    await new Promise((res, rej) => {
      txFiles.oncomplete = () => res();
      txFiles.onerror = () => rej(txFiles.error);
    });

    // 2. Save Meta (Clips, Script, Gap, SelectedFileId)
    // Strip raw AudioBuffer from clips when storing metadata (will be reconstructed from source audio)
    const cleanClips = clips.map((c) => ({
      id: c.id,
      sourceFileId: c.sourceFileId,
      sourceFileName: c.sourceFileName,
      start: c.start,
      end: c.end,
      duration: c.duration,
    }));

    const txMeta = db.transaction(STORE_META, 'readwrite');
    const metaStore = txMeta.objectStore(STORE_META);

    metaStore.put({
      key: 'current_project',
      clips: cleanClips,
      gapSeconds,
      script,
      selectedFileId,
      updatedAt: Date.now(),
    });

    await new Promise((res, rej) => {
      txMeta.oncomplete = () => res();
      txMeta.onerror = () => rej(txMeta.error);
    });

    return true;
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
    return false;
  }
}

/**
 * Loads the saved audio files and project metadata from IndexedDB.
 */
export async function loadProjectFromStorage() {
  try {
    const db = await openDB();

    // 1. Load Files
    const txFiles = db.transaction(STORE_FILES, 'readonly');
    const filesStore = txFiles.objectStore(STORE_FILES);
    const storedFiles = await new Promise((res, rej) => {
      const req = filesStore.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });

    // Convert stored file records back into File objects
    const audioFiles = storedFiles.map((sf) => {
      const file = new File([sf.blob], sf.name, {
        type: sf.type || 'audio/wav',
        lastModified: sf.lastModified || Date.now(),
      });
      return {
        id: sf.id,
        file,
        buffer: null,
        objectUrl: null,
        loading: true,
        error: null,
      };
    });

    // 2. Load Meta
    const txMeta = db.transaction(STORE_META, 'readonly');
    const metaStore = txMeta.objectStore(STORE_META);
    const metaRecord = await new Promise((res) => {
      const req = metaStore.get('current_project');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });

    return {
      audioFiles,
      clips: metaRecord?.clips || [],
      gapSeconds: metaRecord?.gapSeconds ?? 0.3,
      script: metaRecord?.script || '',
      selectedFileId: metaRecord?.selectedFileId || null,
    };
  } catch (err) {
    console.error('Failed to load project from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears all stored project files and state from IndexedDB.
 */
export async function clearProjectStorage() {
  try {
    const db = await openDB();
    const tx1 = db.transaction(STORE_FILES, 'readwrite');
    tx1.objectStore(STORE_FILES).clear();
    const tx2 = db.transaction(STORE_META, 'readwrite');
    tx2.objectStore(STORE_META).clear();
    return true;
  } catch (err) {
    console.error('Failed to clear IndexedDB:', err);
    return false;
  }
}
