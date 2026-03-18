const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * Web-specific API base URL resolution.
 * Defaults to '/proxy' for Vite/Nginx proxy setups.
 */
export const getApiBase = (): string => {
  const globalBase = (globalThis as { __PENG_API_BASE_URL__?: string }).__PENG_API_BASE_URL__;
  if (globalBase && typeof globalBase === 'string') {
    return trimTrailingSlash(globalBase);
  }

  return '/proxy';
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBase()}${normalizedPath}`;
};
