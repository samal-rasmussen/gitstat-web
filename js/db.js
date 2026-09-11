/**
 * Dataset persistence: one IndexedDB database with one object
 * store and one key. The dataset record — the parsed object plus its byte
 * size — is stored by structured clone, which is faster than re-parsing text
 * and has no size ceiling in practice.
 */

const DB_NAME = "smol-gitstat";
const STORE_NAME = "dataset";
const KEY = "current";

/**
 * Open (and on first use create) the database.
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run one request in its own transaction and resolve with its result.
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest} operation
 * @returns {Promise<unknown>}
 */
async function withStore(mode, operation) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Read the stored dataset record.
 * @returns {Promise<DatasetRecord | null>} The record, or null when none is stored.
 */
export async function get() {
  const record = await withStore("readonly", (store) => store.get(KEY));
  return record === undefined ? null : /** @type {DatasetRecord} */ (record);
}

/**
 * Store a dataset record, replacing any previous one.
 * @param {DatasetRecord} record
 * @returns {Promise<void>}
 */
export async function set(record) {
  await withStore("readwrite", (store) => store.put(record, KEY));
}

/**
 * Remove the stored dataset record.
 * @returns {Promise<void>}
 */
export async function clear() {
  await withStore("readwrite", (store) => store.clear());
}
