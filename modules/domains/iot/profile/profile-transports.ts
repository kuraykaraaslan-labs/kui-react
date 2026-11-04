'use client';
import { useEffect, useMemo, useState } from 'react';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import { transportChoices, type ProfileTransport, type ProfileTransportOption } from '../types/profile';

const DEFAULT_BUILTINS: readonly ProfileTransport[] = ['MQTT', 'HTTP', 'ANY'];

/**
 * The transports a profile may take on this host: the built-ins it offers (`transports`, else `profiles.transports`, else MQTT, HTTP,
 * ANY), labelled by the kit's texts, then the polled transports it lists (`profiles.transportOptions`, NB: the workspace's protocols)
 * with their own labels. The list is the same for the editor, the new-profile drawer and the list's filter; a select adds the profile's
 * current value to it (`transportChoices`) so a value that is not offered still reads with its label. A host whose list fails keeps the
 * built-ins.
 */
export function useProfileTransports(transports?: readonly ProfileTransport[]): ProfileTransportOption[] {
  const adapter = useIotAdapter();
  const api = adapter.profiles;
  const { m } = useIotText();
  const [polled, setPolled] = useState<ProfileTransportOption[]>([]);
  useEffect(() => {
    if (!api?.transportOptions) return;
    const ctrl = new AbortController();
    api.transportOptions(ctrl.signal).then((list) => { if (!ctrl.signal.aborted) setPolled(list); }, () => undefined);
    return () => ctrl.abort();
  }, [api]);
  const builtins = transports ?? api?.transports ?? DEFAULT_BUILTINS;
  return useMemo(() => transportChoices([...builtins, ...polled], (t) => m.transport[t]), [builtins, polled, m]);
}
