/**
 * 오프라인 저장 대기열(IndexedDB). 연결이 없을 때 저장한 내용을 사진 파일까지 그대로 보관했다가, 연결되면 올립니다.
 * 기기마다 따로 있고 다른 사람에게는 보이지 않습니다.
 */
export type OutboxItem<T = unknown> = { id: string; kind: string; label: string; payload: T; createdAt: string };

const DB = 'ngmg-outbox';
const STORE = 'items';
/** 대기열이 바뀌면 이 이름의 이벤트를 window에 보냅니다. */
export const OUTBOX_EVENT = 'ngmg:outbox';

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

const changed = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

/** 같은 id(같은 기록)를 다시 넣으면 마지막 내용으로 바꿉니다. */
export const outboxPut = async <T>(item: OutboxItem<T>) => {
  await run('readwrite', (store) => store.put(item));
  changed();
};

export const outboxList = async <T>(kind: string) => {
  if (typeof indexedDB === 'undefined') return [];
  const items = await run<OutboxItem<T>[]>('readonly', (store) => store.getAll() as IDBRequest<OutboxItem<T>[]>);
  return items.filter((item) => item.kind === kind).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const outboxRemove = async (id: string) => {
  await run('readwrite', (store) => store.delete(id));
  changed();
};
