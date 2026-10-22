'use client';
import { PlacementCard, BUILTIN_VIEWS, builtinKind, type WidgetKitHost } from '@/modules/app/WidgetKit';
import { SCADA_LOCALE, SCADA_NOW, type ScadaCard } from '../scada.data';

/** What the console tells WidgetKit: English numbers and dates on the server and in the browser alike. */
export const SCADA_KIT_HOST: WidgetKitHost = { locale: SCADA_LOCALE };

/**
 * One card of the console: a builtin WidgetKit kind drawn by `PlacementCard` at the demo's fixed clock, in a box the
 * page sizes (`className`). kui-ejs draws the same card with modules/app/WidgetKit/PlacementCard.ejs.
 */
export function ScadaPlacement({ card, className, id }: { card: ScadaCard; className?: string; id?: string }) {
  const kind = builtinKind(card.kind);
  if (!kind) return null;
  return (
    <div id={id} className={className}>
      <PlacementCard
        title={card.title}
        template={kind.template}
        slots={kind.slots}
        view={BUILTIN_VIEWS[card.kind]}
        settings={card.settings}
        data={card.data}
        boundSlots={Object.keys(card.data)}
        now={SCADA_NOW}
        viewProps={{ now: SCADA_NOW }}
      />
    </div>
  );
}
