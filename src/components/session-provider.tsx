"use client";

import { SessionProvider as NextSessionProvider } from "next-auth/react";

// next-auth v4 ships its react module without the "use client" directive,
// which crashes in Next 16 server components. This wrapper marks it as a
// client boundary once for the whole app.
export function SessionProvider(props: React.ComponentProps<typeof NextSessionProvider>) {
  return <NextSessionProvider {...props} />;
}
