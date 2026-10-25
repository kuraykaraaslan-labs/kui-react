'use client';
import '@/libs/config/fontawesome';
import { usePathname } from 'next/navigation';
import { ShowcaseShell } from '@/modules/showcase/ui/ShowcaseShell';

const BYPASS_PREFIXES = ['/internal/', '/theme/'];

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const bypass = BYPASS_PREFIXES.some((p) => pathname.startsWith(p));

  if (bypass) return <>{children}</>;
  return <ShowcaseShell>{children}</ShowcaseShell>;
}
