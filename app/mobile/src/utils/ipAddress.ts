const IP_LOOKUP_URL = 'https://ipwho.is/?fields=success,ip';
const IP_LOOKUP_TIMEOUT_MS = 3000;

interface IpLookupResponse {
  success?: boolean;
  ip?: unknown;
}

export const getCurrentIpAddress = async (): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(IP_LOOKUP_URL, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return '';
    }

    const data = (await response.json()) as IpLookupResponse;
    if (data.success !== true || typeof data.ip !== 'string') {
      return '';
    }

    return data.ip.trim();
  } catch {
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
};
