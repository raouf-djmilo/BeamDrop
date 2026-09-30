/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Persistent Folder Handle Store (IndexedDB)
 * Allows 1-Click Zero-ZIP in-place folder updates via File System Access API
 */

const DB_NAME = 'BeamDropFolderStore';
const DB_VERSION = 1;
const STORE_NAME = 'extension_directory';
const KEY_NAME = 'local_extension_dir_handle';

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

async function saveFolderHandle(dirHandle) {
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(dirHandle, KEY_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function getFolderHandle() {
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_NAME);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function removeFolderHandle() {
  const db = await openFolderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(KEY_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function verifyPermission(dirHandle, readWrite = true) {
  if (!dirHandle) return false;
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  // Check existing permission
  if ((await dirHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  // Request user permission
  if ((await dirHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.BeamDropFolderStore = {
    saveFolderHandle,
    getFolderHandle,
    removeFolderHandle,
    verifyPermission
  };
}
