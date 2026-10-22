'use client';
import { Avatar } from '@/modules/ui/Avatar';
import { Button } from '@/modules/ui/Button';
import { DropdownMenu, mergeMenuItems, type DropdownItem } from '@/modules/ui/DropdownMenu';
import type { SafeUser, UserProfile } from '../types';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faUser, faGear, faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons';

/** Ids of the built-in items; an extra item with one of these ids replaces it. */
export type UserMenuDefaultItemId = 'profile' | 'settings' | 'sign-out';

export type UserMenuLabels = { profile?: string; settings?: string; signOut?: string };

/**
 * What the menu shows of the user, for a host that has no full `SafeUser` at hand (a session
 * with an email and a profile). Without a `userRole` the trigger shows the name alone.
 */
export type UserMenuUser = Pick<SafeUser, 'email'> & {
  userRole?: string | null;
  userProfile?: Pick<UserProfile, 'name' | 'profilePicture'> | null;
};

/**
 * Where the built-in items sit. Contributed items without a `group` join `account`, and
 * without an `order` land at {@link USER_MENU_EXTRA_ORDER}: after the account items, before
 * sign out. A group whose lowest order is 1000 or more sits after sign out.
 */
export const USER_MENU_ORDER = { profile: 100, settings: 200, signOut: 1000 } as const;
export const USER_MENU_EXTRA_ORDER = 500;

export function UserMenu({
  user,
  items,
  extraItems,
  mergeItems = false,
  profileHref,
  settingsHref,
  signOutHref,
  onProfile,
  onSettings,
  onSignOut,
  labels,
  align = 'right',
  onlyAvatar = false,
  portal = false,
  className,
}: {
  user: SafeUser | UserMenuUser;
  /** Replaces the built-in items, unless `mergeItems` is set. */
  items?: DropdownItem[];
  /** Items other modules contribute; always merged with the menu's items, never replacing them. */
  extraItems?: DropdownItem[];
  /** Treat `items` as additions to the built-in items instead of a replacement. */
  mergeItems?: boolean;
  profileHref?: string;
  settingsHref?: string;
  signOutHref?: string;
  onProfile?: () => void;
  onSettings?: () => void;
  onSignOut?: () => void;
  labels?: UserMenuLabels;
  align?: 'left' | 'right';
  onlyAvatar?: boolean;
  /**
   * Render the open menu in `document.body` (fixed under the trigger), so a clipping or
   * stacking parent, such as a sticky top bar, cannot cut it off.
   */
  portal?: boolean;
  className?: string;
}) {
  const displayName = user.userProfile?.name ?? user.email;
  const avatar      = user.userProfile?.profilePicture ?? null;

  const builtIn: DropdownItem[] = [
    { type: 'item', id: 'profile',  group: 'account', order: USER_MENU_ORDER.profile,  label: labels?.profile ?? 'Profile',   href: profileHref,  onClick: onProfile,  icon: <FontAwesomeIcon icon={faUser} className="w-3.5 h-3.5" aria-hidden="true" /> },
    { type: 'item', id: 'settings', group: 'account', order: USER_MENU_ORDER.settings, label: labels?.settings ?? 'Settings', href: settingsHref, onClick: onSettings, icon: <FontAwesomeIcon icon={faGear} className="w-3.5 h-3.5" aria-hidden="true" /> },
    { type: 'item', id: 'sign-out', group: 'session', order: USER_MENU_ORDER.signOut,  label: labels?.signOut ?? 'Sign out', href: signOutHref,  onClick: onSignOut,  icon: <FontAwesomeIcon icon={faArrowRightFromBracket} className="w-3.5 h-3.5" aria-hidden="true" />, danger: true },
  ];

  // Contributed items fit around the built-in ones unless they say where they go; one that
  // replaces a built-in item (same id) keeps that item's place.
  const placed = (list: DropdownItem[] = []) =>
    list.map((item) => {
      if (item.type === 'separator' || item.type === 'heading') return item;
      const replaced = builtIn.find((b) => b.id !== undefined && b.id === item.id);
      const slot = replaced && replaced.type !== 'separator' && replaced.type !== 'heading' ? replaced : undefined;
      return {
        ...item,
        group: item.group ?? slot?.group ?? 'account',
        order: item.order ?? slot?.order ?? USER_MENU_EXTRA_ORDER,
      };
    });

  let menuItems: DropdownItem[];
  if (items && !mergeItems) {
    menuItems = extraItems?.length ? mergeMenuItems(items, extraItems) : items;
  } else {
    menuItems = mergeMenuItems(builtIn, placed([...(items ?? []), ...(extraItems ?? [])]));
  }

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`User menu for ${displayName}`}
      className={cn('group gap-2 px-2')}
    >
      <Avatar src={avatar} name={displayName} size="sm" />
      {!onlyAvatar && (
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-medium text-text-primary truncate max-w-[8rem]">{displayName}</p>
          {user.userRole && <p className="text-xs text-text-secondary truncate">{user.userRole}</p>}
        </div>
      )}
      {/* DropdownMenu sets aria-expanded on the trigger: the chevron turns over while the menu is open. */}
      <FontAwesomeIcon
        icon={faChevronDown}
        className="w-3 h-3 text-text-disabled hidden sm:block transition-transform group-aria-expanded:rotate-180"
        aria-hidden="true"
      />
    </Button>
  );

  const header = (
    <div className="px-3 py-2.5">
      <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
      <p className="text-xs text-text-secondary truncate">{user.email}</p>
    </div>
  );

  return (
    <DropdownMenu trigger={trigger} items={menuItems} header={header} align={align} portal={portal} className={className} />
  );
}
