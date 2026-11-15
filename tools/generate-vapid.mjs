// Generates a VAPID ES256 key pair locally. Do not commit its output.
import { webcrypto } from 'node:crypto';

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const privateKey = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const rawPublicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(publicKey.x, 'base64url'),
  Buffer.from(publicKey.y, 'base64url'),
]).toString('base64url');

console.log('MERYOS_VAPID_PUBLIC_KEY=' + rawPublicKey);
console.log('MERYOS_VAPID_KEYS_JSON=' + JSON.stringify({ publicKey, privateKey }));
console.log('\nKeep the second line private. It belongs only in Supabase Edge Function Secrets.');
