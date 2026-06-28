function getRootDomain() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  
  // Handle localhost or IPs
  if (hostname === 'localhost' || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    return '';
  }

  // SECURITY TRADEOFF: We explicitly allowlist .deckly.space to enable cross-subdomain SSO.
  // Because this is used for Supabase client-side auth, it cannot be HttpOnly (JS needs to read it).
  // This means any JS on any deckly.space subdomain can read the token. We accept this risk
  // because all subdomains are fully trusted and controlled by us (no 3rd party custom domains).
  if (hostname === 'deckly.space' || hostname.endsWith('.deckly.space')) {
    return '.deckly.space';
  }
  
  return '';
}

const CHUNK_SIZE = 3000;

function getSingleCookie(key: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(key + '=')) {
      try {
        return decodeURIComponent(cookie.substring(key.length + 1));
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

function setSingleCookie(key: string, value: string): void {
  if (typeof document === 'undefined') return;
  const domain = getRootDomain();
  const domainString = domain ? `domain=${domain}; ` : '';
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  const secureString = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${key}=${encodeURIComponent(value)}; ${domainString}path=/; expires=${expires.toUTCString()}; SameSite=Lax${secureString}`;
}

function removeSingleCookie(key: string): void {
  if (typeof document === 'undefined') return;
  const domain = getRootDomain();
  const domainString = domain ? `domain=${domain}; ` : '';
  const secureString = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${key}=; ${domainString}path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureString}`;
}

export const cookieStorage = {
  getItem: (key: string): string | null => {
    let value = '';
    let i = 0;
    while (true) {
      const chunk = getSingleCookie(`${key}.${i}`);
      if (chunk !== null) {
        value += chunk;
        i++;
      } else {
        break;
      }
    }
    if (value) return value;
    
    // Fallback to legacy unchunked key if chunk 0 doesn't exist
    return getSingleCookie(key);
  },
  
  setItem: (key: string, value: string): void => {
    cookieStorage.removeItem(key); // Clear existing chunks and legacy key
    
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      setSingleCookie(`${key}.${i / CHUNK_SIZE}`, value.slice(i, i + CHUNK_SIZE));
    }
  },

  removeItem: (key: string): void => {
    // Remove legacy unchunked key just in case
    removeSingleCookie(key);
    
    // Remove all chunks until we hit one that doesn't exist
    let i = 0;
    while (true) {
      const chunk = getSingleCookie(`${key}.${i}`);
      if (chunk !== null) {
        removeSingleCookie(`${key}.${i}`);
        i++;
      } else {
        break;
      }
    }
  }
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
