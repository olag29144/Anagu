/**
 * Shared types for the Community Verification Oracle.
 * Requirements 5.1–5.8
 */

/** Claim submitted by a citizen for ownership verification. */
export interface OwnershipClaim {
  applicationId: string;
  parcelRef: string;
  ownerName: string;
  documentNumber: string;
  documentType: string;
  issuingAuthority: string;
}

/** Four possible outcomes from the oracle (Req 5.2–5.5). */
export type VerificationOutcome =
  | 'SuccessfullyVerified'
  | 'OwnershipConflict'
  | 'IncompleteDocuments'
  | 'LegalVerificationPending';

/** Structured result returned by `OracleService.verify()`. */
export interface VerificationResult {
  outcome: VerificationOutcome;
  score?: number;
  reason?: string;
}
