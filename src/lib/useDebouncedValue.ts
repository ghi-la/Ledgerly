'use client';

import { useEffect, useState } from 'react';

/** `value`, but only once it has stopped changing for `delayMs` - for keying requests off text inputs. */
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
