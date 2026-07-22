const DB_NAME = "LeafletDB";
const STORE_NAME = "books";

export function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

export async function saveBook(id, name, arrayBuffer) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const record = {
      id,
      name,
      buffer: arrayBuffer,
      updatedAt: Date.now()
    };
    
    const request = store.put(record);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function loadBook(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = (e) => resolve(e.target.result?.buffer || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteBook(id) {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function listBooks() {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = (e) => {
      const records = e.target.result || [];
      // Return metadata only to keep memory footprint light
      resolve(records.map(r => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt,
        size: r.buffer.byteLength
      })));
    };
    
    request.onerror = (e) => reject(e.target.error);
  });
}
