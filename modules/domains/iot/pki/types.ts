/**
 * The device certificate types of the PKI components (NB `iot_pki`, docs/concepts/iot-platform/phases/13-device-certificates.md). The
 * shapes are NB's API views (`CertificateView`, `RecoveryView`); dates are ISO strings. Never a private key, never a CSR.
 */

/** A certificate in the platform's ledger. */
export type CertificateStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED' | 'EXPIRED';
/** RFC 5280 reasons the platform uses. `superseded` is the renewal's own and never chosen by a person. */
export type RevocationReason = 'keyCompromise' | 'superseded' | 'cessationOfOperation' | 'unspecified';
/** The reasons a person may revoke with (the revoke dialog's choices). */
export type RevokeReason = Exclude<RevocationReason, 'superseded'>;
export type IssuedVia = 'BOOTSTRAP' | 'RENEWAL' | 'RECOVERY' | 'SERVER_KEYGEN' | 'UPLOAD' | 'ENROLL';
export type CertificateKeyAlg = 'EC-P256' | 'EC-P384' | 'RSA-2048' | 'RSA-3072' | 'RSA-4096';

export type DeviceCertificate = {
  certificateId: string;
  subjectTenantId?: string | null;
  deviceSerial: string | null;
  subjectCn: string;
  issuerCaId: string;
  /** The issuing CA's name when the host knows it (the root tenant's operators); the id is shown otherwise. */
  issuerName?: string | null;
  serialNumberHex: string;
  fingerprintSha256: string;
  keyAlg: CertificateKeyAlg | string;
  notBefore: string;
  notAfter: string;
  status: CertificateStatus;
  revokedAt: string | null;
  revocationReason: RevocationReason | null;
  issuedVia: IssuedVia | string;
  /** The platform generated the key and handed it over once (a re-key campaign replaces it). */
  serverKeygen: boolean;
  supersedesCertificateId: string | null;
  /** The device's first connection with this certificate. */
  firstSeenAt: string | null;
  /** When the cloud asked the device to renew it (`cert.renew`, once per certificate). */
  renewRequestedAt?: string | null;
  createdAt?: string;
};

export type RecoveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'USED' | 'EXPIRED';

/** A device that lost its key asks for a new certificate while its current one is still valid: its owner decides. */
export type RecoveryRequest = {
  recoveryId: string;
  subjectTenantId?: string;
  deviceSerial: string;
  deviceId: string | null;
  currentCertificateId: string | null;
  /** The device asked the platform to generate its key (no CSR of its own). */
  keygen: boolean;
  /** SHA-256 of the parked key: an approval is bound to it. */
  keyId: string | null;
  status: RecoveryStatus;
  /** Attempts with another key while the request was open (a clone may be trying). */
  otherKeyAttempts: number;
  requestedAt: string;
  lastAttemptAt: string;
  expiresAt: string;
  decidedAt: string | null;
  revocationReason: string | null;
  issuedCertificateId: string | null;
  usedAt: string | null;
};

/** The old certificate's revocation reason of an approval. */
export type RecoveryRevocationReason = 'keyCompromise' | 'superseded';
export type RecoveryDecision = { decision: 'APPROVE'; revocationReason: RecoveryRevocationReason } | { decision: 'REJECT' };

/** Filter values of the certificates table (NB's list parameters). */
export type CertificateExpiryWindow = '7' | '30' | '90';
