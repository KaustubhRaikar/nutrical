import { signRequest } from './signing';

export interface AuthSession {
  id: string;
  email: string;
  token: string;
  signing_key: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public serverTime?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | string;
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://nutricalapi.aarambhtech.in/';
const DEFAULT_APP_KEY = 'nutrical_secret_2c0m6';

let activeSession: AuthSession | null = null;
let onUnauthorizedHandler: (() => void | Promise<void>) | null = null;
let clockOffsetSeconds = 0;

export function setApiSession(session: AuthSession | null): void {
  activeSession = session;
}

export function getApiSession(): AuthSession | null {
  return activeSession;
}

export function setOnUnauthorized(handler: () => void | Promise<void>): void {
  onUnauthorizedHandler = handler;
}

export function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
  return url.endsWith('/') ? url : `${url}/`;
}

export function getAppKey(): string {
  return process.env.EXPO_PUBLIC_API_APP_KEY || DEFAULT_APP_KEY;
}

/**
 * Dispatches a signed API request to the NutriCal backend with automated
 * signing v2, timeout controls, clock skew correction, and session handling.
 */
export async function apiFetch<T = any>(
  action: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  return executeApiFetch<T>(action, options, {
    retriedStale: false,
    retriedReplay: false,
  });
}

async function executeApiFetch<T>(
  action: string,
  options: ApiFetchOptions,
  retryState: { retriedStale: boolean; retriedReplay: boolean }
): Promise<T> {
  const method = (options.method || (options.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const timeoutMs = options.timeoutMs ?? 10000;

  // 1. Build Query Parameters & Canonical pathAndQuery
  const searchParams = new URLSearchParams();
  searchParams.append('action', action);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
  }

  const pathAndQuery = `/?${searchParams.toString()}`;
  const baseUrl = getBaseUrl();
  const targetUrl = `${baseUrl.replace(/\/$/, '')}${pathAndQuery}`;

  // 2. Prepare Body String
  let bodyString = '';
  if (options.body !== undefined && options.body !== null) {
    bodyString = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  // 3. Determine Signing Key
  const isPublicAuthAction = action === 'login' || action === 'register';
  let signingKey = getAppKey();
  if (!isPublicAuthAction && activeSession?.signing_key) {
    signingKey = activeSession.signing_key;
  }

  // 4. Calculate Signature with Skew-Adjusted Timestamp
  const adjustedTimestamp = (Math.floor(Date.now() / 1000) + clockOffsetSeconds).toString();
  const signedHeaders = signRequest({
    method,
    pathAndQuery,
    body: bodyString,
    key: signingKey,
    timestamp: adjustedTimestamp,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': signedHeaders['X-TIMESTAMP'],
    'X-NONCE': signedHeaders['X-NONCE'],
    'X-SIGNATURE': signedHeaders['X-SIGNATURE'],
  };

  if (!isPublicAuthAction && activeSession?.token) {
    headers['X-SESSION-TOKEN'] = activeSession.token;
  }

  // 5. Execute Request with Timeout
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = bodyString;
    }

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutTimer);

    let data: any;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(
        'INVALID_RESPONSE',
        `Backend returned non-JSON response (HTTP ${response.status})`,
        response.status
      );
    }

    // 6. Inspect for Security & Session Errors
    if (
      response.status === 401 &&
      (data.code === 'INVALID_SESSION' || data.message === 'Invalid session')
    ) {
      if (onUnauthorizedHandler) {
        try {
          await onUnauthorizedHandler();
        } catch (handlerError) {
          console.error('Error in onUnauthorizedHandler:', handlerError);
        }
      }
      throw new ApiError('INVALID_SESSION', data.message || 'Invalid session', 401);
    }

    // Handle Stale Timestamp -> Adjust Clock and Retry Once
    if (
      response.status === 401 &&
      data.code === 'STALE_TIMESTAMP' &&
      data.server_time &&
      !retryState.retriedStale
    ) {
      const serverTime = Number(data.server_time);
      if (!isNaN(serverTime) && serverTime > 0) {
        clockOffsetSeconds = serverTime - Math.floor(Date.now() / 1000);
        return executeApiFetch<T>(action, options, {
          ...retryState,
          retriedStale: true,
        });
      }
    }

    // Handle Nonce Replay -> Retry Once with New Nonce
    if (response.status === 401 && data.code === 'REPLAY' && !retryState.retriedReplay) {
      return executeApiFetch<T>(action, options, {
        ...retryState,
        retriedReplay: true,
      });
    }

    // General Failure Check
    if (!response.ok || data.success === false) {
      throw new ApiError(
        data.code || `HTTP_${response.status}`,
        data.message || 'Request failed',
        response.status,
        data.server_time ? Number(data.server_time) : undefined
      );
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutTimer);

    if (error.name === 'AbortError') {
      throw new ApiError('TIMEOUT', `Request timed out after ${timeoutMs}ms`, 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('NETWORK_ERROR', error.message || 'Network request failed', 0);
  }
}
