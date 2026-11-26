const SESSION_KEY = 'ad-session';
const ROOM_CREATION_KEY = 'ad-room-creation-request';

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

export function getRoomCreationRequestId(storage) {
  try {
    const target = storage || globalThis.sessionStorage;
    if (!target) return '';
    let requestId = target.getItem(ROOM_CREATION_KEY);
    if (!requestId) {
      requestId = globalThis.crypto?.randomUUID?.();
      if (!requestId) return '';
      target.setItem(ROOM_CREATION_KEY, requestId);
    }
    return requestId;
  } catch {
    return '';
  }
}

export function clearRoomCreationRequestId(storage) {
  try {
    (storage || globalThis.sessionStorage)?.removeItem(ROOM_CREATION_KEY);
    return true;
  } catch {
    return false;
  }
}
