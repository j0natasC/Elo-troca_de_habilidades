import crypto from 'node:crypto';

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_FALLBACK_KEY;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

export function signAuthToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateFourDigitOtp(): string {
  const num = crypto.randomInt(1000, 9999);
  return String(num);
}

export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(code).digest('hex');
}
