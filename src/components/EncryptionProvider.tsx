'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { exportDekRawB64, importDekRawB64 } from '@/lib/cryptoField';

const DEK_STORAGE_KEY = 'ledgerly-dek';

interface EncryptionContextValue {
  dek: CryptoKey | null;
  /** True once the provider has finished trying to restore a cached key from this browser tab's session. */
  ready: boolean;
  setDek: (dek: CryptoKey | null) => void;
  clear: () => void;
}

const EncryptionContext = createContext<EncryptionContextValue>({
  dek: null,
  ready: false,
  setDek: () => {},
  clear: () => {},
});

/** Access to the current session's data-encryption key (DEK), if unlocked. */
export const useEncryption = () => useContext(EncryptionContext);

/**
 * Holds the in-memory DEK for the session. It's mirrored to sessionStorage
 * (not localStorage) so a page refresh doesn't force re-entering the
 * password, but it's still cleared the moment the browser tab closes — the
 * same trust boundary as the session cookie itself.
 */
export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const [dek, setDekState] = useState<CryptoKey | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = window.sessionStorage.getItem(DEK_STORAGE_KEY);
      if (stored) {
        try {
          const key = await importDekRawB64(stored);
          if (!cancelled) setDekState(key);
        } catch {
          window.sessionStorage.removeItem(DEK_STORAGE_KEY);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDek = useCallback((key: CryptoKey | null) => {
    setDekState(key);
    if (key) {
      exportDekRawB64(key).then((b64) => window.sessionStorage.setItem(DEK_STORAGE_KEY, b64));
    } else {
      window.sessionStorage.removeItem(DEK_STORAGE_KEY);
    }
  }, []);

  const clear = useCallback(() => {
    setDekState(null);
    window.sessionStorage.removeItem(DEK_STORAGE_KEY);
  }, []);

  return (
    <EncryptionContext.Provider value={{ dek, ready, setDek, clear }}>{children}</EncryptionContext.Provider>
  );
}
