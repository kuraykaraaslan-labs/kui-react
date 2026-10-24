import { redirect } from 'next/navigation';

/** The old seed ids (alert-001 …), redirected for one release (OD-9). */
export function generateStaticParams() {
  return ['alert-001', 'alert-002', 'alert-003', 'alert-004', 'alert-005'].map((id) => ({ id }));
}

/** OD-9: /theme/iot/alerts/[id] → /theme/iot/alarms/[id] (alert-001 → alarm-001), for one release. */
export default async function AlertRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/theme/iot/alarms/${id.replace(/^alert-/, 'alarm-')}`);
}
