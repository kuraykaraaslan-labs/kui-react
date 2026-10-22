'use client';
import { WidgetKitProvider } from '@/modules/app/WidgetKit';
import { PageHeader } from '@/modules/ui/PageHeader';
import { SCADA_BRAND, scadaDiagram } from '../scada.data';
import { SCADA_KIT_HOST, ScadaPlacement } from './ScadaPlacement';

const DIAGRAM = scadaDiagram();

/**
 * The diagram page: the "Home network" process diagram across the page and, under it, the legend of the four symbols
 * in each state. kui-ejs draws the same page in views/theme/scada/_diagram.ejs (without the editor link).
 */
export function ScadaDiagram() {
  const d = DIAGRAM;
  return (
    <WidgetKitProvider value={SCADA_KIT_HOST}>
      <div className="space-y-6">
        <PageHeader
          title="Diagram"
          subtitle={`${SCADA_BRAND.site}: power and network connections`}
          actions={[{ label: 'Edit diagram', href: '/theme/scada/editor', variant: 'outline' }]}
        />
        <ScadaPlacement card={d.scene} className="h-80 lg:h-[500px]" />
        <ScadaPlacement card={d.legend} className="h-44 lg:h-80" />
      </div>
    </WidgetKitProvider>
  );
}
