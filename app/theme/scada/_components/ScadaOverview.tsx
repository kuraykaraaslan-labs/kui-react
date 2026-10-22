'use client';
import { WidgetKitProvider } from '@/modules/app/WidgetKit';
import { PageHeader } from '@/modules/ui/PageHeader';
import { StatCard } from '@/modules/ui/StatCard';
import { SCADA_BRAND, scadaOverview } from '../scada.data';
import { SCADA_KIT_HOST, ScadaPlacement } from './ScadaPlacement';

const OVERVIEW = scadaOverview();

/**
 * The console's first page: status tiles, the "Home network" diagram, the recent events, the four devices with their
 * readings and every state a symbol shows. kui-ejs draws the same page in views/theme/scada/_overview.ejs.
 */
export function ScadaOverview() {
  const o = OVERVIEW;
  return (
    <WidgetKitProvider value={SCADA_KIT_HOST}>
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          subtitle={`${SCADA_BRAND.site}: live readings of every device`}
          actions={[{ label: 'Open diagram', href: '/theme/scada/diagram', variant: 'outline' }]}
        />

        <section aria-label="Status" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {o.tiles.map((t) => <StatCard key={t.id} label={t.label} value={t.value} accent={t.accent} />)}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <ScadaPlacement card={o.scene} className="h-72 lg:col-span-2 lg:h-[420px]" />
          <ScadaPlacement card={o.events} id="scada-events" className="scroll-mt-6 lg:h-[420px]" />
        </div>

        <section aria-labelledby="scada-devices" className="space-y-3">
          <h2 id="scada-devices" className="text-sm font-semibold text-text-primary">Devices</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {o.devices.map((c) => <ScadaPlacement key={c.key} card={c} className="h-52" />)}
          </div>
        </section>

        <section aria-labelledby="scada-states" className="space-y-3">
          <h2 id="scada-states" className="text-sm font-semibold text-text-primary">Symbol states</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {o.states.map((c) => <ScadaPlacement key={c.key} card={c} className="h-52" />)}
          </div>
        </section>
      </div>
    </WidgetKitProvider>
  );
}
