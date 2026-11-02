import { createDemoFleetAdapter, createDemoSettingsAdapter } from '@/modules/domains/iot/settings/demo-settings';
import type { DeviceSettingsAdapter, SettingsFleetAdapter } from '@/modules/domains/iot/settings/settings-adapter';
import { DEVICES } from '../iot.data';

const idOf = (slug: string) => DEVICES.find((d) => d.slug === slug)?.deviceId ?? slug;

/** One settings demo store per browser tab, kept across the demo's pages: the assembly robot's gateway is the Roltek router. */
let settingsSingleton: DeviceSettingsAdapter | null = null;
let fleetSingleton: SettingsFleetAdapter | null = null;
export const demoSettingsAdapter = (): DeviceSettingsAdapter => (settingsSingleton ??= createDemoSettingsAdapter({
  devices: { router: idOf('assembly-robot-gateway'), unsupported: idOf('press-line-sensor-a1'), unknown: idOf('dev-prototype-x') },
}));
export const demoFleetAdapter = (): SettingsFleetAdapter => (fleetSingleton ??= createDemoFleetAdapter());
