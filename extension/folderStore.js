/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Persistent Folder Handle Store (IndexedDB)
 * Stores both directory handle and folder name.
 * Provides granular permission lifecycle checking ('granted' | 'prompt' | 'denied').
 */

const DB_NAME = 'BeamDropFolderStore';
const DB_VERSION = 1;
const STORE_NAME = 'extension_directory';
const KEY_NAME = 'local_extension_dir_handle';
const KEY_FOLDER_NAME = 'local_extension_folder_name';

function openFolderDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save directoryHandle AND folder name into IndexedDB
 */
async function saveFolderHandle(dirHandle) {
  if (!dirHandle) return false;
  const folderName = dirHandle.name || 'beamdrop-extension';
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(dirHandle, KEY_NAME);
    store.put(folderName, KEY_FOLDER_NAME);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve both handle and folder name
 */
async function getFolderData() {
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const reqHandle = store.get(KEY_NAME);
    const reqName = store.get(KEY_FOLDER_NAME);
    tx.oncomplete = () => {
      let handle = reqHandle.result || null;
      let folderName = reqName.result || '';
      if (handle && handle.handle) {
        folderName = folderName || handle.folderName || handle.handle.name || '';
        handle = handle.handle;
      } else if (handle && handle.name) {
        folderName = folderName || handle.name;
      }
      resolve({ handle, folderName });
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve handle (backward compatible)
 */
async function getFolderHandle() {
  const data = await getFolderData();
  return data.handle;
}

/**
 * Retrieve folder name
 */
async function getFolderName() {
  const data = await getFolderData();
  return data.folderName || (data.handle ? data.handle.name : '');
}

/**
 * Remove folder handle and metadata
 */
async function removeFolderHandle() {
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY_NAME);
    store.delete(KEY_FOLDER_NAME);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Non-intrusive permission query: returns 'granted' | 'prompt' | 'denied'
 */
async function queryPermission(dirHandle, readWrite = true) {
  if (!dirHandle || typeof dirHandle.queryPermission !== 'function') return 'denied';
  try {
    const options = { mode: readWrite ? 'readwrite' : 'read' };
    return await dirHandle.queryPermission(options);
  } catch (e) {
    return 'prompt';
  }
}

/**
 * Explicit user-gesture permission request: returns 'granted' | 'prompt' | 'denied'
 */
async function requestPermission(dirHandle, readWrite = true) {
  if (!dirHandle || typeof dirHandle.requestPermission !== 'function') return 'denied';
  try {
    const options = { mode: readWrite ? 'readwrite' : 'read' };
    return await dirHandle.requestPermission(options);
  } catch (e) {
    return 'denied';
  }
}

/**
 * Backward compatible permission check
 */
async function verifyPermission(dirHandle, readWrite = true) {
  if (!dirHandle) return false;
  const status = await queryPermission(dirHandle, readWrite);
  if (status === 'granted') return true;
  const reqStatus = await requestPermission(dirHandle, readWrite);
  return reqStatus === 'granted';
}

if (typeof window !== 'undefined') {
  window.BeamDropFolderStore = {
    saveFolderHandle,
    getFolderHandle,
    getFolderData,
    getFolderName,
    removeFolderHandle,
    queryPermission,
    requestPermission,
    verifyPermission
  };
}
