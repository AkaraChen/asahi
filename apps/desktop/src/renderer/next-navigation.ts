import { useMemo } from 'react';

import { navigateDesktop } from './navigation';

export function useRouter() {
  return useMemo(
    () => ({
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      prefetch: async () => undefined,
      push: (href: string) => navigateDesktop(href),
      refresh: () => undefined,
      replace: (href: string) => navigateDesktop(href, { replace: true }),
    }),
    []
  );
}

export function redirect(href: string): never {
  navigateDesktop(href, { replace: true });
  throw new Error(`Redirected to ${href}`);
}

export const permanentRedirect = redirect;
