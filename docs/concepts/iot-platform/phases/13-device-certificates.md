# Phase 13 — Device certificates (NB `iot_pki` phase 03 §3.5)

Written 2026-11-05, English. NB plan: `$NEXT_BOILERPLATE_ROOT/docs/concepts/iot-pki/phases/03-renewal-rotation-ops.md` (§3.1 `cert.renew`,
§3.2 recovery approval, §3.5 operations UI; decisions D452-D457 in its end block).

## What NB needs

The platform issues every Roltek device its X.509 client certificate, renews it (the device by 30 days before `notAfter`, the cloud's
`cert.renew` at 21 days as a safety net), revokes it, and asks the owner when a device that lost its key wants a new certificate while the
current one is still valid. Operators and tenant admins see the certificates and the recovery requests; the device page shows the device's
certificate with Renew and Revoke and a pending recovery with Approve / Reject.

## Built (2026-11-05) — `modules/domains/iot/pki/`

| Component | What it does |
|---|---|
| `CertificateStatusBadge` | Active (amber with the days left under 30), Superseded, Revoked, Expired; `certificateDaysLeft`, `renewOffered` (ACTIVE and < 30 days left or a platform-generated key) |
| `CertificateDetailCard` | Subject, issuer, serial number and fingerprint (copy), validity, key type, how it was issued, first use, renewal asked, revocation; a note for a platform-generated key or < 30 days left; "Renew certificate" (only when offered) through `ConfirmDialog`, "Revoke" through `RevokeCertificateDialog` |
| `RevokeCertificateDialog` | `ConfirmDialog` (danger) with the reason as a select (Key compromise by default, Device retired, Unspecified; never Superseded) and the serial typed again |
| `RecoveryRequestCard` | Who asks, when, until when, the key an approval is bound to, attempts with another key (a warning); Approve (the old certificate's revocation reason as a select) and Reject, each through `ConfirmDialog` |
| `CertificateTable`, `RecoveryRequestTable` | `DataTable` lists with search, Filters (status, issued by, key type, expiry window / status), sortable columns, rows per page; `onQueryChange` = the host serves the pages (`mode="manual"`, NB's list parameters) |

Texts: `PKI_MESSAGES` (`messages.ts`), a host passes `messages`. Demo: `/theme/iot/certificates` (operations lists opening their cards in
drawers, the device page's card with Renew and Revoke, a pending recovery). Tests: `modules/domains/iot/pki/pki.test.tsx`.

## Not here

The root tenant's CA view (CA list, CRL status) is NB's own page section; root rotation, the `rd.` leaf and tenants' own ENROLL
certificates have no UI yet.
