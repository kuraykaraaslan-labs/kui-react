'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSimCard } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import type { EsimAdapter } from './esim-adapter';
import type { EsimMessagesInput } from './messages';
import { EsimPanel } from './EsimPanel';
import { useEsimText } from './EsimText';
import { ESIM_IN_FLIGHT, type EsimAbilities, type EsimDeviceView } from './types';

export interface EsimDeviceActionProps {
  adapter: EsimAdapter;
  deviceId: string;
  can?: EsimAbilities;
  /** Open the drawer at once (a deep link). */
  defaultOpen?: boolean;
  messages?: EsimMessagesInput;
  locale?: string;
}

/**
 * EsimDeviceAction — the device page's "eSIM" header button and its drawer (NB iot_esim D468: a header button with a drawer, never a
 * tab). It draws NOTHING for a device whose router does not manage an eSIM chip (no `esim` capability, no chip reported, or a chip the
 * router cannot drive): the button exists only where an operation could work. While an operation is on its way the button says so.
 */
export function EsimDeviceAction({ adapter, deviceId, can, defaultOpen = false, messages, locale }: EsimDeviceActionProps) {
  const { m, locale: lang } = useEsimText(messages, locale);
  const [view, setView] = useState<EsimDeviceView | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (open) return;
    const ac = new AbortController();
    adapter.device(deviceId, ac.signal).then(setView, () => { if (!ac.signal.aborted) setView(null); });
    return () => ac.abort();
  }, [adapter, deviceId, open]);
  const follow = useCallback((v: EsimDeviceView) => setView(v), []);

  if (!open && !view?.supported) return null;
  const working = !!view?.inFlight && ESIM_IN_FLIGHT.has(view.inFlight.state);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog" data-esim-action={deviceId}>
        <FontAwesomeIcon icon={faSimCard} className="mr-1.5" aria-hidden="true" />{working ? m.action.busy : m.action.open}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={m.action.title} closeLabel={m.common.close} className="w-full sm:max-w-3xl">
        {open && <EsimPanel adapter={adapter} deviceId={deviceId} can={can} inDrawer onView={follow} messages={m} locale={lang} />}
      </Drawer>
    </>
  );
}
