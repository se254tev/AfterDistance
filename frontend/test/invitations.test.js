import test from 'node:test';
import assert from 'node:assert/strict';
import { copyInvitationText, getInvitationLink, getWhatsAppShareUrl } from '../src/invitations.js';

const roomCode = 'ABCDEF123456';
const frontendOrigin = 'https://afterdistance.netlify.app';

test('invitation link targets the existing room on the frontend origin', () => {
  assert.equal(
    getInvitationLink(roomCode, frontendOrigin),
    `${frontendOrigin}/join/${roomCode}`
  );
});

test('WhatsApp invitation includes game name, actual code and room link', () => {
  const shareUrl = new URL(getWhatsAppShareUrl(roomCode, frontendOrigin));
  const message = shareUrl.searchParams.get('text');

  assert.equal(shareUrl.origin, 'https://wa.me');
  assert.match(message, /The Other Side of Us/);
  assert.match(message, new RegExp(roomCode));
  assert.match(message, new RegExp(`${frontendOrigin}/join/${roomCode}`));
  assert.doesNotMatch(message, /sessionId|token/i);
});

test('invitation link rejects invalid room codes', () => {
  assert.throws(() => getInvitationLink('ROOM123'), /valid room code/i);
});

test('copy helper reports successful clipboard writes and failures', async () => {
  let copied = '';
  await copyInvitationText('invite text', {
    async writeText(value) { copied = value; }
  });
  assert.equal(copied, 'invite text');

  await assert.rejects(() => copyInvitationText('invite text', {
    async writeText() { throw new Error('permission denied'); }
  }), /permission denied/);
});
