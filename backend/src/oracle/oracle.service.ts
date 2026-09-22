import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt-topics';
import { OwnershipClaim, VerificationResult } from './oracle.types';

/**
 * OracleService — community & institutional ownership verification.
 *
 * Applies rules in priority order (Req 5.2–5.5):
 *  1. INCOMPLETE  — any required field is absent
 *  2. PENDING     — institutional record has legalHold: true
 *  3. CONFLICT    — Jaro-Winkler name similarity < 0.85 or document mismatch
 *  4. MATCH       — Jaro-Winkler ≥ 0.85 AND exact document number match
 *
 * Every code path audits and publishes MQTT before returning (Req 5.7, 5.8).
 *
 * Requirements: 5.1–5.8
 */
@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly mqttService: MqttService,
  ) {}

  /**
   * Verify an ownership claim against institutional and community data.
   *
   * @param claim - The citizen's ownership claim fields.
   * @returns A `VerificationResult` with outcome, optional score, and reason.
   */
  async verify(claim: OwnershipClaim): Promise<VerificationResult> {
    // Rule 1 — INCOMPLETE: any required field absent (Req 5.2)
    const requiredFields: (keyof OwnershipClaim)[] = [
      'ownerName',
      'documentNumber',
      'documentType',
      'issuingAuthority',
      'parcelRef',
    ];
    const missingField = requiredFields.find((f) => !claim[f]?.trim());
    if (missingField) {
      const result: VerificationResult = {
        outcome: 'IncompleteDocuments',
        reason: `Required field missing: ${missingField}`,
      };
      await this.recordAndPublish(claim.applicationId, result);
      return result;
    }

    // Fetch institutional record for the parcel
    const institutionalRecord = await this.fetchInstitutionalRecord(claim.parcelRef);

    // Rule 2 — PENDING: legal hold active (Req 5.3)
    if (institutionalRecord.legalHold) {
      const result: VerificationResult = {
        outcome: 'LegalVerificationPending',
        reason: 'Legal hold is active on this parcel',
      };
      await this.recordAndPublish(claim.applicationId, result);
      return result;
    }

    // Rule 3 — CONFLICT: name similarity or document mismatch (Req 5.4)
    const similarity = this.jaroWinkler(
      claim.ownerName.toLowerCase(),
      (institutionalRecord.ownerName ?? '').toLowerCase(),
    );
    const documentMatch =
      claim.documentNumber === institutionalRecord.documentNumber;

    if (similarity < 0.85 || !documentMatch) {
      const result: VerificationResult = {
        outcome: 'OwnershipConflict',
        score: similarity,
        reason: documentMatch
          ? `Name similarity ${similarity.toFixed(3)} below threshold 0.85`
          : 'Document number mismatch',
      };
      await this.recordAndPublish(claim.applicationId, result);
      return result;
    }

    // Rule 4 — MATCH (Req 5.5)
    const result: VerificationResult = {
      outcome: 'SuccessfullyVerified',
      score: similarity,
    };
    await this.recordAndPublish(claim.applicationId, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Audit + MQTT publish on every code path (Req 5.7, 5.8). */
  private async recordAndPublish(
    applicationId: string,
    result: VerificationResult,
  ): Promise<void> {
    await this.auditService.record({
      entityId: applicationId,
      action: 'ORACLE_VERIFICATION',
      outcome: result.outcome,
      metadata: { score: result.score, reason: result.reason },
    });

    await this.mqttService.publish(
      MQTT_TOPICS.VERIFICATION_RESULT.topic,
      {
        applicationId,
        outcome: result.outcome,
        timestamp: new Date().toISOString(),
      },
      MQTT_TOPICS.VERIFICATION_RESULT.qos,
    );
  }

  /**
   * Stub institutional data source — returns mock data.
   * In production this would call an HTTP endpoint or Supabase RPC.
   */
  private async fetchInstitutionalRecord(parcelRef: string): Promise<{
    ownerName?: string;
    documentNumber?: string;
    legalHold: boolean;
  }> {
    // Production implementation will query an external institutional registry.
    // For now, return a non-holding stub so the pipeline can proceed in tests.
    this.logger.debug(`Fetching institutional record for parcel ${parcelRef}`);
    return { legalHold: false };
  }

  /**
   * Jaro-Winkler similarity — pure TypeScript implementation.
   * Returns a value in [0, 1]; ≥ 0.85 is considered a match (Req 5.5).
   */
  private jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1.length || !s2.length) return 0;

    const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array<boolean>(s1.length).fill(false);
    const s2Matches = new Array<boolean>(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / s1.length +
        matches / s2.length +
        (matches - transpositions / 2) / matches) /
      3;

    // Winkler prefix bonus (up to 4 chars)
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
