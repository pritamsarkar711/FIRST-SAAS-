import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True after hydration on the client, false during SSR and the first client
 * render snapshot. Compliant replacement for the setState-in-effect mount flag.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
