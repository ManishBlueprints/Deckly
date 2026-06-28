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
      } catch {
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
    const manifest = getSingleCookie(key);
    
    if (manifest && manifest.startsWith('chunk-count:')) {
      const count = parseInt(manifest.substring('chunk-count:'.length), 10);
      if (isNaN(count) || count < 1) {
        return null; // Corrupted manifest
      }
      let value = '';
      for (let i = 0; i < count; i++) {
        const chunk = getSingleCookie(`${key}.${i}`);
        if (chunk === null) {
          return null; // Missing a chunk in the sequence, session is corrupted
        }
        value += chunk;
      }
      return value;
    }
    
    // Legacy fallback (either legacy unchunked string, or null)
    return manifest;
  },
  
  setItem: (key: string, value: string): void => {
    cookieStorage.removeItem(key); // Clear existing chunks and legacy key
    
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    
    setSingleCookie(key, `chunk-count:${chunks.length}`);
    chunks.forEach((chunk, i) => {
      setSingleCookie(`${key}.${i}`, chunk);
    });
  },

  removeItem: (key: string): void => {
    const manifest = getSingleCookie(key);
    removeSingleCookie(key); // Remove manifest or legacy string
    
    if (manifest && manifest.startsWith('chunk-count:')) {
      const count = parseInt(manifest.substring('chunk-count:'.length), 10);
      if (!isNaN(count) && count > 0) {
        for (let i = 0; i < count; i++) {
          removeSingleCookie(`${key}.${i}`);
        }
        return; // Successfully deleted manifest-based chunks
      }
    }
    
    // It might be a partially deleted chunked session, a corrupted manifest, or legacy unchunked.
    // Let's do a best-effort cleanup of chunks just in case.
    let i = 0;
      while (i < 100) { // arbitrary safe limit
        const chunk = getSingleCookie(`${key}.${i}`);
        if (chunk !== null) {
          removeSingleCookie(`${key}.${i}`);
        } else {
          break; // Stop at first missing chunk if we don't know the count
        }
        i++;
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
