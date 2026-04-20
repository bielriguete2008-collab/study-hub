// lib/security/jwt.js — Tokens internos JWT (HMAC-SHA256)
const SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const SALT   = process.env.JWT_SALT   || 'fallback-salt';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hmac(key, data) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Buffer.from(sig).toString('base64url');
}
function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function parseB64url(str) { return JSON.parse(Buffer.from(str, 'base64url').toString('utf8')); }

export async function hashPhone(phone) { const sig = await hmac(SALT, phone); return sig.substring(0, 32); }

export async function signToken(payload) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body   = b64url({ ...payload, iat: Date.now(), exp: Date.now() + TTL_MS });
  const sig    = await hmac(SECRET, `${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

export async function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expectedSig = await hmac(SECRET, `${header}.${body}`);
    if (sig !== expectedSig) return null;
    const payload = parseB64url(body);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
