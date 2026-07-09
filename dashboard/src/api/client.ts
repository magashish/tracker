import { ApiEnvelope, ApiErrorBody } from '../types/api';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const STORAGE_KEY = 'tracker.admin.tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

let tokens: StoredTokens | null = loadTokens();
let refreshPromise: Promise<boolean> | null = null;
const listeners = new Set<(tokens: StoredTokens | null) => void>();

function loadTokens(): StoredTokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

function setTokens(next: StoredTokens | null) {
  tokens = next;
  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener(next));
}

export function onAuthChange(listener: (tokens: StoredTokens | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTokens(): StoredTokens | null {
  return tokens;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/admin/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setTokens(null);
          return false;
        }
        const body = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
        setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
        return true;
      })
      .catch(() => {
        setTokens(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && tokens) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error.code ?? 'UNKNOWN', body?.error.message ?? response.statusText, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export async function apiRequestPaginated<T>(
  path: string,
  options: { query?: Record<string, string | number | undefined> } = {}
): Promise<{ items: T[]; total: number; page: number; pageSize: number }> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const doFetch = () =>
    fetch(url.toString(), {
      headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    });

  let response = await doFetch();
  if (response.status === 401 && tokens) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doFetch();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error.code ?? 'UNKNOWN', body?.error.message ?? response.statusText, response.status);
  }
  const envelope = (await response.json()) as ApiEnvelope<T[]>;
  return {
    items: envelope.data,
    total: envelope.meta?.total ?? envelope.data.length,
    page: envelope.meta?.page ?? 1,
    pageSize: envelope.meta?.pageSize ?? envelope.data.length,
  };
}

export function setAuthTokens(next: { accessToken: string; refreshToken: string } | null) {
  setTokens(next);
}
