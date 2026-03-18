const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getApiBase = (): string => {
  const globalBase = (globalThis as { __PENG_API_BASE_URL__?: string }).__PENG_API_BASE_URL__;
  if (globalBase && typeof globalBase === 'string') {
    return trimTrailingSlash(globalBase);
  }

  return trimTrailingSlash(process.env.API_URL || 'http://localhost:8080');
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBase()}${normalizedPath}`;
};
