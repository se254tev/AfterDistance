import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(testDirectory, '../src/App.jsx'), 'utf8');
const centreSource = fs.readFileSync(path.join(testDirectory, '../src/HelpLegal.jsx'), 'utf8');

test('help, legal and contact routes are declared', () => {
  for (const route of ['/help', '/copyright', '/privacy-policy', '/terms', '/contact']) {
    assert.match(appSource, new RegExp(`path="${route.replace('/', '\\/')}"`));
  }
});

test('homepage footer exposes all centre destinations', () => {
  assert.match(appSource, /Help &amp; How to Play/);
  assert.match(appSource, /Copyright/);
  assert.match(appSource, /Privacy Policy/);
  assert.match(appSource, /User Agreement/);
  assert.match(appSource, /Contact Us/);
});

test('contact centre uses the official WhatsApp number and legal pages have no draft notices', () => {
  assert.match(centreSource, /\+254 797 819 571/);
  assert.match(centreSource, /254797819571/);
  assert.match(centreSource, /Office of the Data Protection Commissioner/);
  assert.doesNotMatch(centreSource, /draft|owner and legal review|not a substitute for professional legal advice|final binding document until approved/i);
  assert.match(centreSource, /Copyright Act, 2001/);
  assert.match(centreSource, /Data Protection Act, 2019/);
});
