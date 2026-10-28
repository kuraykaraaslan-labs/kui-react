/*
 * The page-wide signal that a profile's telemetry keys were renamed and their readers rewritten (NB phase 39 UX-11). The profile editor
 * sends it after "Update them to the new names"; an Alarm rules tab of the same profile that is already mounted (a tab stays mounted once
 * opened) renames the keys in the rules it holds, its unsaved edits included, so its next save cannot put the old keys back.
 */
export const PROFILE_KEYS_RENAMED_EVENT = 'kui-iot:profile-keys-renamed';

export type ProfileKeysRenamed = { profileId: string; renames: Record<string, string> };

export function announceProfileKeyRenames(detail: ProfileKeysRenamed): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProfileKeysRenamed>(PROFILE_KEYS_RENAMED_EVENT, { detail }));
}

/** Calls `listener` with the renames (`{ old: new }`) of every signal about `profileId`; returns the unsubscribe. */
export function onProfileKeyRenames(profileId: string, listener: (renames: Record<string, string>) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handle = (e: Event) => {
    const d = (e as CustomEvent<ProfileKeysRenamed>).detail;
    if (d && d.profileId === profileId && d.renames) listener(d.renames);
  };
  window.addEventListener(PROFILE_KEYS_RENAMED_EVENT, handle);
  return () => window.removeEventListener(PROFILE_KEYS_RENAMED_EVENT, handle);
}
