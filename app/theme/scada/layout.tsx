'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/modules/app/AppShell';
import { AppSidebar, type AppSidebarNavGroup } from '@/modules/app/AppSidebar';
import { Avatar } from '@/modules/ui/Avatar';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouseSignal,
  faGaugeHigh,
  faDiagramProject,
  faPenRuler,
  faBell,
  faChevronDown,
  faCircleUser,
  faArrowRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import { SCADA_ALARM_COUNT, SCADA_BRAND, SCADA_USER } from './scada.data';

const NAV_GROUPS: AppSidebarNavGroup[] = [
  {
    label: 'Monitor',
    items: [
      {
        id: 'overview', label: 'Overview', href: '/theme/scada',
        icon: <FontAwesomeIcon icon={faGaugeHigh} className="w-4 h-4" aria-hidden="true" />,
        badge: SCADA_ALARM_COUNT > 0 ? <Badge variant="warning" size="sm">{SCADA_ALARM_COUNT}</Badge> : undefined,
      },
      {
        id: 'diagram', label: 'Diagram', href: '/theme/scada/diagram',
        icon: <FontAwesomeIcon icon={faDiagramProject} className="w-4 h-4" aria-hidden="true" />,
      },
    ],
  },
  {
    label: 'Engineer',
    items: [
      {
        id: 'editor', label: 'Diagram editor', href: '/theme/scada/editor',
        icon: <FontAwesomeIcon icon={faPenRuler} className="w-4 h-4" aria-hidden="true" />,
      },
    ],
  },
];

const ACTIVE_BY_PATH: Record<string, string> = {
  '/theme/scada/diagram': 'diagram',
  '/theme/scada/editor': 'editor',
};

/** The signed-in user at the foot of the sidebar; the menu opens upwards. */
function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={collapsed ? `Account: ${SCADA_USER.name}` : undefined}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <Avatar src="" name={SCADA_USER.name} size="sm" />
        {!collapsed && (
          <div className="flex flex-1 min-w-0 items-center justify-between">
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium text-text-primary">{SCADA_USER.name}</p>
              <p className="truncate text-xs text-text-secondary">{SCADA_USER.email}</p>
            </div>
            <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 text-text-secondary" aria-hidden="true" />
          </div>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-xl border border-border bg-surface-base py-1 shadow-lg">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-text-primary">{SCADA_USER.name}</p>
            <p className="text-xs text-text-secondary">{SCADA_USER.email} · {SCADA_USER.role}</p>
          </div>
          <Link href="/theme/scada" className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary">
            <FontAwesomeIcon icon={faCircleUser} className="w-4 h-4" aria-hidden="true" />
            Profile
          </Link>
          <button type="button" className="flex w-full items-center gap-3 px-4 py-2 text-sm text-error transition-colors hover:bg-error-subtle">
            <FontAwesomeIcon icon={faArrowRightFromBracket} className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function ScadaThemeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const activeId = ACTIVE_BY_PATH[pathname.replace(/\/$/, '')] ?? 'overview';
  return (
    <AppShell
      mobileSidebarTitle={SCADA_BRAND.name}
      logo={
        <Link href="/theme/scada" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <FontAwesomeIcon icon={faHouseSignal} className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold tracking-tight text-text-primary">{SCADA_BRAND.name}</span>
        </Link>
      }
      sidebar={
        <AppSidebar
          navGroups={NAV_GROUPS}
          activeId={activeId}
          searchable={false}
          footer={({ collapsed }) => <SidebarFooter collapsed={collapsed} />}
        />
      }
      topbar={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">{SCADA_BRAND.site}</span>
            {SCADA_ALARM_COUNT > 0 && (
              <Badge variant="warning" dot>{SCADA_ALARM_COUNT === 1 ? '1 warning' : `${SCADA_ALARM_COUNT} warnings`}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="xs" iconOnly aria-label="Events" as="a" href="/theme/scada#scada-events">
              <span className="relative">
                <FontAwesomeIcon icon={faBell} className="w-4 h-4" aria-hidden="true" />
                {SCADA_ALARM_COUNT > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning ring-2 ring-surface-raised" />}
              </span>
            </Button>
            <Avatar src="" name={SCADA_USER.name} size="xs" />
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
