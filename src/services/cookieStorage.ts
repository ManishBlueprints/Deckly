function getRootDomain() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  
  // Handle localhost or IPs
  if (hostname === 'localhost' || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    return '';
  }

  // Explicit allowlist for cross-subdomain sharing to prevent over-broadening
  if (hostname === 'deckly.space' || hostname.endsWith('.deckly.space')) {
    return '.deckly.space';
  }
  
  return '';
}

export const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(key + '=')) {
        return decodeURIComponent(cookie.substring(key.length + 1));
      }
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const domain = getRootDomain();
    const domainString = domain ? `domain=${domain}; ` : '';
    // Use an expiration of 1 year for auth tokens
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const secureString = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${key}=${encodeURIComponent(value)}; ${domainString}path=/; expires=${expires.toUTCString()}; SameSite=Lax${secureString}`;
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const domain = getRootDomain();
    const domainString = domain ? `domain=${domain}; ` : '';
    const secureString = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${key}=; ${domainString}path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureString}`;
  },
};

// Migrate existing localStorage tokens to cookieStorage
if (typeof window !== 'undefined') {
  try {
    if (typeof window.localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const value = localStorage.getItem(key);
        if (value) {
          cookieStorage.setItem('deckly-auth-token', value);
          // Only remove the localStorage token if the cookie was successfully written
          if (cookieStorage.getItem('deckly-auth-token') === value) {
            localStorage.removeItem(key);
          }
          break;
        }
      }
    }
    }
  } catch {
    // Ignore access errors
  }
}
