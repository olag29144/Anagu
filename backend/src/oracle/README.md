# Community & Institutional Ownership Verification Oracle

This module implements `OracleService.verify()` (`POST /oracle/verify`) to cross-check an applicant's land ownership claim against community attestations (`CommunitySourceClient`) and statutory institutional registry records (`InstitutionalSourceClient`).

## Comparison Rules & Priority Order

Rules are evaluated strictly in the following priority order:

1. **`IncompleteDocuments` (Incomplete supporting documents)**
   - **Rule A — Missing claim fields**: Any of the five required claim fields (`ownerName`, `documentNumber`, `documentType`, `issuingAuthority`, `parcelRef`) is absent, non-string, or empty after `.trim()`.
   - **Rule B — Missing or mismatched community attestation**: `CommunitySourceClient.fetchRecord(claim.parcelRef)` returns `null`, returns a record whose `parcelRef !== claim.parcelRef`, or has zero non-empty entries in `communityAttestations`.

2. **`LegalVerificationPending` (Legal hold active)**
   - Evaluated only after Rule 1 passes.
   - Triggered when the institutional registry record has `legalHold === true`.
   - No similarity or document-number judgment is made while a court injunction or statutory hold is active.

3. **`OwnershipConflict` (Conflict between claim and registry record)**
   - Evaluated only when `legalHold === false`.
   - **Name comparison**: Normalizes both strings via `.trim().toLowerCase()` and computes Jaro-Winkler similarity (`jaroWinkler(submittedName, institutionalOwner)` in `[0, 1]`).
   - **Document comparison**: Strict trimmed string equality (`submittedDocument === institutionalDocument`).
   - Triggered when **either**:
     - `jaroWinkler(submittedName, institutionalOwner) < 0.85`, **or**
     - `submittedDocument !== institutionalDocument`.

4. **`SuccessfullyVerified` (Exact match / verified claim)**
   - Triggered if and only if:
     - All five required claim fields are non-empty,
     - A parcel-matched community attestation (`>= 1` non-empty attestation) exists,
     - `legalHold === false`,
     - `jaroWinkler(submittedName, institutionalOwner) >= 0.85`, **and**
     - `submittedDocument === institutionalDocument`.

## Source Availability & Telemetry Guarantees

- If `CommunitySourceClient` or `InstitutionalSourceClient` throws an upstream error, `OracleService` records an audit entry (`outcome: 'SOURCE_UNAVAILABLE'`) and publishes `{ applicationId, outcome: 'SourceUnavailable', timestamp }` to `land/verification/result` (QoS 1) before rethrowing.
- Every deterministic outcome (`SuccessfullyVerified`, `OwnershipConflict`, `IncompleteDocuments`, `LegalVerificationPending`) writes an `ORACLE_VERIFICATION` row to `audit_trail` and publishes a `land/verification/result` MQTT event (QoS 1) before returning.
