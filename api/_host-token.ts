import crypto from 'crypto';

// Claims carried by a host-signed SSO token (HS256 JWT).
// `sub` is the host's stable user id, e.g. "tmh:<supabase-uuid>".
export interface HostClaims {
  sub: string;
  name?: string;     // display name, mirrored to leaderboards
  num?: number;
  country?: string;
  avatar?: string;   // profile picture URL, mirrored to leaderboards
  iat?: number;
  exp: number;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function verifyHostToken(token: string, secret: string): HostClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: HostClaims;
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = b64urlDecode(sigB64);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;

  return claims;
}
