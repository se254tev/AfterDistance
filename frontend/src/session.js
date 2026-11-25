const SESSION_KEY = 'ad-session';

export function getStoredSession(storage) {
  try {
    const persistentStorage = storage || globalThis.localStorage;
    let value = persistentStorage?.getItem(SESSION_KEY);
    if (!value && !storage) {
      value = globalThis.sessionStorage?.getItem(SESSION_KEY);
      if (value) persistentStorage?.setItem(SESSION_KEY, value);
    }
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function saveStoredSession(session, storage) {
  if (!session?.sessionId || !session?.roomCode) return false;
  try {
    const target = storage || globalThis.localStorage;
    if (!target) return false;
    target.setItem(SESSION_KEY, JSON.stringify({
      sessionId: session.sessionId,
      roomCode: session.roomCode,
      nickname: session.nickname || ''
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredSession(storage) {
  try {
    (storage || globalThis.localStorage)?.removeItem(SESSION_KEY);
    if (!storage) globalThis.sessionStorage?.removeItem(SESSION_KEY);
  } catch {
    return false;
  }
  return true;
}
