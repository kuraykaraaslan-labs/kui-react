'use client';
import Link from 'next/link';
import { AppShell } from '@/modules/app/AppShell';
import { AppSidebar, type AppSidebarNavGroup } from '@/modules/app/AppSidebar';
import { Avatar } from '@/modules/ui/Avatar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faMicrochip,
  faBell,
  faCloud,
  faGear,
  faCircleUser,
  faArrowRightFromBracket,
  faChevronDown,
  faDiagramProject,
  faTableCells,
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { IotAdapterProvider } from '@/modules/domains/iot/api/IotAdapterProvider';
import type { IotNotify } from '@/modules/domains/iot/api/IotAdapterProvider';
import { AlarmBellMenu } from '@/modules/domains/iot/alarm/AlarmBellMenu';
import { Toaster, toast } from '@/modules/ui/Toast';
import { createDemoAdapter, startDemoSimulation } from './_demo/demo-adapter';
import { createDemoLive } from './_demo/demo-live';

const NAV_GROUPS: AppSidebarNavGroup[] = [
  {
    items: [
      { id: 'dashboard',  label: 'Dashboard',   icon: <FontAwesomeIcon icon={faServer}    className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot' },
      { id: 'widgets',    label: 'Widget gallery', icon: <FontAwesomeIcon icon={faTableCells} className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot/widgets' },
      { id: 'devices',    label: 'Devices',      icon: <FontAwesomeIcon icon={faMicrochip}       className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot/devices',   badge: 7 },
      { id: 'alarms',     label: 'Alarms',       icon: <FontAwesomeIcon icon={faBell}           className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot/alarms' },
      { id: 'workspaces', label: 'Workspaces',   icon: <FontAwesomeIcon icon={faCloud}          className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot/workspaces' },
      { id: 'rulesets',   label: 'Rulesets',     icon: <FontAwesomeIcon icon={faDiagramProject} className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot/rulesets'   },
      { id: 'settings',   label: 'Settings',     icon: <FontAwesomeIcon icon={faGear}           className="w-4 h-4" aria-hidden="true" />, href: '/theme/iot'            },
    ],
  },
];

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <Avatar src="" name="Alex Müller" size="sm" />
        {!collapsed && (
          <div className="flex flex-1 min-w-0 items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">Alex Müller</p>
              <p className="truncate text-xs text-text-secondary">alex@acme.io</p>
            </div>
            <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 text-text-secondary" aria-hidden="true" />
          </div>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-border bg-surface-base shadow-lg py-1 z-50">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-text-primary">Alex Müller</p>
            <p className="text-xs text-text-secondary">alex@acme.io · OWNER</p>
          </div>
          <Link href="/theme/iot" className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors">
            <FontAwesomeIcon icon={faCircleUser} className="w-4 h-4" aria-hidden="true" />
            Profile
          </Link>
          <button className="flex w-full items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error-subtle transition-colors">
            <FontAwesomeIcon icon={faArrowRightFromBracket} className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const notify: IotNotify = ({ tone, message }) => {
  if (tone === 'success') toast.success(message);
  else if (tone === 'error') toast.error(message);
  else toast.info(message);
};

/** The sidebar entry of the current route (the social theme's `resolveActiveId` precedent). */
function activeIdOf(pathname: string | null): string {
  const seg = (pathname ?? '').replace(/^\/theme\/iot\/?/, '').split('/')[0];
  if (!seg) return 'dashboard';
  return seg === 'alerts' ? 'alarms' : seg;
}

export default function IoTThemeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // One demo store and live source for the whole demo session (phase 00 §0.5).
  const live = useMemo(() => createDemoLive(), []);
  const adapter = useMemo(() => createDemoAdapter(live), [live]);
  useEffect(() => startDemoSimulation(adapter), [adapter]);
  return (
    <IotAdapterProvider adapter={adapter} live={live} notify={notify} locale="en-GB">
    <AppShell
      mobileSidebarTitle="Nexus"
      logo={
        <Link href="/theme/iot" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <FontAwesomeIcon icon={faServer} className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold text-text-primary tracking-tight">Nexus</span>
        </Link>
      }
      sidebar={
        <AppSidebar
          navGroups={NAV_GROUPS}
          activeId={activeIdOf(pathname)}
          searchable
          footer={({ collapsed }) => <SidebarFooter collapsed={collapsed} />}
        />
      }
      topbar={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Smart Factory Alpha</span>
          <div className="flex items-center gap-2">
            <AlarmBellMenu hrefs={{ alarms: '/theme/iot/alarms', alarm: (id) => `/theme/iot/alarms/${id}` }} />
            <Avatar src="" name="Alex Müller" size="xs" />
          </div>
        </div>
      }
      mainClassName="overflow-hidden p-0"
    >
      <main id="main-content" className="h-full overflow-y-auto">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </AppShell>
    </IotAdapterProvider>
  );
}
