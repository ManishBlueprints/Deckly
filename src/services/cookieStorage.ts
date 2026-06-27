function getRootDomain() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  
  // Handle localhost or IPs
  if (hostname === 'localhost' || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    return '';
  }

  // Extract root domain (e.g., 'deckly.space' from 'app.deckly.space')
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }
  return '';
}

export const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const domain = getRootDomain();
    const domainString = domain ? `domain=${domain}; ` : '';
    // Use an expiration of 1 year for auth tokens
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${key}=${encodeURIComponent(value)}; ${domainString}path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const domain = getRootDomain();
    const domainString = domain ? `domain=${domain}; ` : '';
    document.cookie = `${key}=; ${domainString}path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
  },
};

// Migrate existing localStorage tokens to cookieStorage
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const value = localStorage.getItem(key);
        if (value) {
          cookieStorage.setItem('deckly-auth-token', value);
          localStorage.removeItem(key);
          break;
        }
      }
    }
  } catch {
    // Ignore access errors
  }
}
