import CryptoJS from 'crypto-js';

export interface SignRequestParams {
  method: string;
  pathAndQuery: string;
  body?: string;
  key: string;
  timestamp?: string;
  nonce?: string;
}

export interface SignedHeaders {
  'X-TIMESTAMP': string;
  'X-NONCE': string;
  'X-SIGNATURE': string;
}

/**
 * Generates a cryptographically random UUID for request nonces.
 * Uses expo-crypto in Expo native environments, falling back to Web Crypto.
 */
export function generateNonce(): string {
  try {
    // Dynamic require for expo-crypto in React Native environment
    const expoCrypto = require('expo-crypto');
    if (expoCrypto && typeof expoCrypto.randomUUID === 'function') {
      return expoCrypto.randomUUID();
    }
  } catch {
    // Fallback for non-native / test environments
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // RFC4122 v4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Computes canonical request signature v2 per AUTHENTICATION.md 2.1 - 2.4.
 * Canonical string format:
 * METHOD\nPATH_AND_QUERY\nTIMESTAMP\nNONCE\nBODY_SHA256
 */
export function signRequest(params: SignRequestParams): SignedHeaders {
  const method = params.method.toUpperCase();
  const pathAndQuery = params.pathAndQuery.startsWith('/')
    ? params.pathAndQuery
    : `/${params.pathAndQuery}`;
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const nonce = params.nonce ?? generateNonce();

  // Compute SHA-256 of the raw body string (empty string if no body)
  const rawBody = params.body ?? '';
  const bodySha256 = CryptoJS.SHA256(rawBody).toString(CryptoJS.enc.Hex);

  const canonicalString = [
    method,
    pathAndQuery,
    timestamp,
    nonce,
    bodySha256
  ].join('\n');

  const signature = CryptoJS.HmacSHA256(canonicalString, params.key).toString(CryptoJS.enc.Hex);

  return {
    'X-TIMESTAMP': timestamp,
    'X-NONCE': nonce,
    'X-SIGNATURE': signature,
  };
}
