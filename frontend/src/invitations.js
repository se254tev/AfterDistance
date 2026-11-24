const ROOM_CODE_PATTERN = /^[a-f0-9]{12}$/i;

export function getInvitationLink(roomCode, origin = globalThis.location?.origin) {
  if (!ROOM_CODE_PATTERN.test(roomCode || '') || !origin) {
    throw new Error('A valid room code and frontend origin are required.');
  }
  return new URL(`/join/${roomCode.toUpperCase()}`, origin).toString();
}

export function getWhatsAppShareUrl(roomCode, origin = globalThis.location?.origin) {
  const invitationLink = getInvitationLink(roomCode, origin);
  const message = `Join me in The Other Side of Us! Room code: ${roomCode.toUpperCase()}. Open this invitation link to join: ${invitationLink}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function copyInvitationText(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
  await clipboard.writeText(text);
}
