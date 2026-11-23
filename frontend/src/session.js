const SESSION_KEY = 'ad-session';

export function getStoredSession(storage = globalThis.sessionStorage) {
  try {
    const value = storage?.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function saveStoredSession(session, storage = globalThis.sessionStorage) {
  if (!session?.sessionId || !session?.roomCode) return false;
  storage?.setItem(SESSION_KEY, JSON.stringify(session));
  return true;
}
