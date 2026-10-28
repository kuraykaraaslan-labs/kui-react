// kui-player's own translations by the kit's locale. Its own module so the card's player and the board's shared
// "still watching?" prompt both read them without one importing the other.
import type { PartialDictionary } from '@kuraykaraaslan/kui-player/locales';
import { playerLanguage } from './content-model';

type Locales = typeof import('@kuraykaraaslan/kui-player/locales');

// One import for every caller (a board's cards and its prompt ask at the same moment); a failed one is tried again.
let loading: Promise<Locales> | null = null;
const loadLocales = (): Promise<Locales> =>
  (loading ??= import('@kuraykaraaslan/kui-player/locales').catch((error: unknown) => { loading = null; throw error; }));

/** The player's dictionary for a kit locale (its base language); English and unknown languages need none. */
export async function playerLocale(locale: string | undefined): Promise<PartialDictionary | undefined> {
  const lang = playerLanguage(locale);
  if (!lang) return undefined;
  return (await loadLocales())[lang];
}
