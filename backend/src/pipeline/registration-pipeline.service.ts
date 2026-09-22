import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SpatialService } from '../spatial/spatial.service';
import { OracleService } from '../oracle/oracle.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt-topics';
import { AuditService } from '../audit/audit.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import {
  ApplicationRecord,
  ApplicationStatus,
  PipelineStage,
} from './pipeline.types';

/**
 * RegistrationPipelineService — orchestrates the end-to-end land registration workflow.
 *
 * Stage ordering (Requirements 9.1):
 *  Stage 1 — GIS spatial verification          (SpatialService)
 *  Stage 2 — Community oracle verification     (OracleService)
 *  Stage 3 — Set status to `in_review`         (awaits Registrar action)
 *  Stage 4 — Registrar approval audit          (human gate)
 *  Stage 5 — Blockchain NFT minting            (BlockchainService)
 *  Stage 6 — Land title DB record              (Supabase land_titles)
 *  Stage 7 — MQTT notification                 (MqttService)
 *
 * Rejection at stages 1 or 2 sets status to `rejected`, audits, and publishes
 * the registration-status MQTT topic (Requirements 9.2).
 *
 * Successful completion at stage 7 produces the NFT token, DB title record,
 * and MQTT notification (Requirements 9.3).
 */
@Injectable()
export class RegistrationPipelineService {
  private readonly logger = new Logger(RegistrationPipelineService.name);

  constructor(
    private readonly spatial: SpatialService,
    private readonly oracle: OracleService,
    private readonly blockchain: BlockchainService,
    private readonly mqtt: MqttService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseClientService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run pipeline stages 1–3 (called immediately on application submission).
   *
   * Stages 1 and 2 are blocking: a failure at either stage rejects the
   * application and halts the pipeline.  Stage 3 moves the application to
   * `in_review` and returns — the Registrar must then call
   * `completeAfterRegistrarApproval()` to proceed.
   *
   * @param applicationId - UUID of the application to process.
   */
  async run(applicationId: string): Promise<void> {
    const app = await this.loadApplication(applicationId);

    // ------------------------------------------------------------------
    // Stage 1 — Spatial verification (Req 2, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 1 — Spatial verification`);
    const spatialResult = await this.spatial.verifySpatial({
      applicationId,
      parcelRing: app.parcel_ring ?? { coordinates: [] },
    });

    if (spatialResult.outcome !== 'approved') {
      await this.reject(
        applicationId,
        'SPATIAL_VERIFICATION',
        `Spatial check failed: ${spatialResult.diagnosticCode ?? spatialResult.outcome}`,
      );
      return;
    }

    // ------------------------------------------------------------------
    // Stage 2 — Oracle / ownership verification (Req 5, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 2 — Oracle verification`);
    const oracleResult = await this.oracle.verify({
      applicationId,
      parcelRef: app.parcel_ref,
      ownerName: app.owner_name,
      documentNumber: app.document_number,
      documentType: app.document_type,
      issuingAuthority: app.issuing_authority,
    });

    if (oracleResult.outcome !== 'SuccessfullyVerified') {
      await this.reject(
        applicationId,
        'ORACLE_VERIFICATION',
        `Oracle check failed: ${oracleResult.outcome}${oracleResult.reason ? ` — ${oracleResult.reason}` : ''}`,
      );
      return;
    }

    // ------------------------------------------------------------------
    // Stage 3 — Move to in_review, await Registrar (Req 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 3 — Setting status to in_review`);
    await this.updateStatus(applicationId, 'in_review');
  }

  /**
   * Run pipeline stages 4–7 after a Registrar approves the application.
   *
   * @param applicationId - UUID of the application being completed.
   * @param registrarId   - UUID of the Registrar acting on the approval.
   */
  async completeAfterRegistrarApproval(
    applicationId: string,
    registrarId: string,
  ): Promise<void> {
    const app = await this.loadApplication(applicationId);

    // ------------------------------------------------------------------
    // Stage 4 — Audit Registrar approval (Req 7.9, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 4 — Auditing Registrar approval`);
    await this.audit.record({
      entityId: applicationId,
      actorId: registrarId,
      action: 'REGISTRAR_APPROVAL',
      outcome: 'APPROVED',
      metadata: { registrarId },
    });

    // ------------------------------------------------------------------
    // Stage 5 — Mint blockchain NFT (Req 3.1, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 5 — Minting NFT`);
    const { tokenId, txHash } = await this.blockchain.mintTitle(
      app.owner_wallet_address,
      app.parcel_ref,
      app.parcel_ref,                            // spatialHash field (parcel_ref used until spatial_hash stored)
      app.title_metadata_uri ?? 'ipfs://pending',
    );

    // ------------------------------------------------------------------
    // Stage 6 — Persist land title in Supabase (Req 3.3, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 6 — Inserting land title record`);
    const { error: titleError } = await this.supabase.raw
      .from('land_titles')
      .insert({
        application_id: applicationId,
        token_id: tokenId.toString(),
        owner_id: app.citizen_id,
        parcel_id: app.id,
        tx_hash: txHash,
        issued_at: new Date().toISOString(),
      });

    if (titleError) {
      throw new Error(`Failed to insert land title: ${titleError.message}`);
    }

    // ------------------------------------------------------------------
    // Stage 7 — Publish MQTT notification (Req 6.1, 9.1)
    // ------------------------------------------------------------------
    this.logger.log(`[${applicationId}] Stage 7 — Publishing MQTT notification`);
    await this.mqtt.publish(
      MQTT_TOPICS.TITLE_ISSUED.topic,
      {
        tokenId: tokenId.toString(),
        owner: app.owner_wallet_address,
        parcelId: app.id,
        timestamp: new Date().toISOString(),
      },
      MQTT_TOPICS.TITLE_ISSUED.qos,
    );

    await this.updateStatus(applicationId, 'completed');
    this.logger.log(`[${applicationId}] Pipeline completed — tokenId=${tokenId}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Reject an application at the given stage.
   * Writes an audit entry, sets status to `rejected`, and publishes MQTT (Req 9.2).
   */
  private async reject(
    applicationId: string,
    stage: PipelineStage,
    reason: string,
  ): Promise<void> {
    this.logger.warn(`[${applicationId}] Rejected at ${stage}: ${reason}`);

    await this.audit.record({
      entityId: applicationId,
      action: stage,
      outcome: 'REJECTED',
      metadata: { reason },
    });

    await this.updateStatus(applicationId, 'rejected');
  }

  /**
   * Update the `status` column of the application row and publish a
   * `land/registration/status` MQTT message (Req 6.1).
   */
  private async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<void> {
    const { error } = await this.supabase.raw
      .from('applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (error) {
      throw new Error(`Failed to update application status: ${error.message}`);
    }

    await this.mqtt.publish(
      MQTT_TOPICS.REGISTRATION_STATUS.topic,
      {
        applicationId,
        status,
        timestamp: new Date().toISOString(),
      },
      MQTT_TOPICS.REGISTRATION_STATUS.qos,
    );
  }

  /**
   * Load a single application row from Supabase.
   * Throws `NotFoundException` if the row does not exist.
   */
  private async loadApplication(applicationId: string): Promise<ApplicationRecord> {
    const { data, error } = await this.supabase.raw
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) {
      throw new NotFoundException(
        `Application ${applicationId} not found: ${error.message}`,
      );
    }

    return data as ApplicationRecord;
  }
}
