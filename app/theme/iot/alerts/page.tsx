import { redirect } from 'next/navigation';

/** OD-9: the demo moved to /theme/iot/alarms; this redirect stays for one release. */
export default function AlertsRedirect() {
  redirect('/theme/iot/alarms');
}
