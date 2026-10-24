import { DEVICES } from '../iot.data';

/** The demo's routes for the views' `hrefs` (NB maps the same views onto its own routes). */
export const demoHrefs = {
  device: (deviceId: string) => `/theme/iot/devices/${DEVICES.find((d) => d.deviceId === deviceId)?.slug ?? deviceId}`,
  alarm: (alarmId: string) => `/theme/iot/alarms/${alarmId}`,
  alarms: '/theme/iot/alarms',
  devices: '/theme/iot/devices',
};

/** A demo device id from the URL's slug (seeded slugs, else the id itself for a device made in the demo). */
export function deviceIdOfSlug(slug: string): string {
  return DEVICES.find((d) => d.slug === slug)?.deviceId ?? slug;
}
