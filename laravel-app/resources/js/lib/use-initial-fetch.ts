import { useEffect } from "react";

/**
 * Runs a data-loading function once after mount. The call is deferred to a
 * macrotask so the first render commits before any state updates occur.
 */
export function useInitialFetch(load: () => void) {
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
}
