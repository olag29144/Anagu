import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';
import { MqttService } from '../mqtt/mqtt.service';
import { MQTT_TOPICS } from '../mqtt/mqtt-topics';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { NotificationService } from './notification.service';
import type { RevocationGround as BlockchainRevocationGround } from '../blockchain/types';

/**
 * Statutory grounds for revocation under the Nigerian Land Use Act (1978) s.28.
 * Maps to the numeric `RevocationGround` in blockchain/types.ts:
 *   'OverridingPublicInterest'    → 0
 *   'BreachOfStatutoryCondition'  → 1
 *
 * References: Requirements 4.7, 4.8, 4.9
 */
export type RevocationGround =
  | 'OverridingPublicInterest'
  | 'BreachOfStatutoryCondition';

const GROUND_INDEX: Record<RevocationGround, BlockchainRevocationGround> = {
  OverridingPublicInterest: 0,
  BreachOfStatutoryCondition: 1,
};

@Injectable()
export class RevocationService {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly auditService: AuditService,
    private readonly mqttService: MqttService,
    private readonly supabase: SupabaseClientService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Statutorily revoke a land title.
   *
   * Steps:
   *  1. Call `BlockchainService.revokeTitle` with the numeric ground index.
   *  2. Update `land_titles` row: set `status = 'revoked'`, `revoked_at = now()`.
   *  3. Update `parcels` row(s): set `status = 'reverted'` WHERE `token_id = tokenId`.
   *  4. Append an audit trail entry for `STATUTORY_REVOCATION`.
   *  5. Publish `TITLE_REVOKED` MQTT event at QoS 2.
   *  6. Send out-of-band notifications (stub).
   *
   * @param tokenId           The ERC-721 token ID to revoke (string representation of BigInt).
   * @param ground            Statutory revocation ground.
   * @param governorId        Supabase auth UUID of the acting governor.
   * @param governorPrivateKey Hex private key of the Governor's wallet.
   */
  async revoke(
    tokenId: string,
    ground: RevocationGround,
    governorId: string,
    governorPrivateKey: string,
  ): Promise<void> {
    // Step 1 — On-chain revocation
    const groundIndex = GROUND_INDEX[ground];
    const txHash = await this.blockchainService.revokeTitle(
      BigInt(tokenId),
      groundIndex,
      governorPrivateKey,
    );

    // Step 2 — Mark land_titles as revoked
    const { error: titleError } = await this.supabase.raw
      .from('land_titles')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('token_id', tokenId);

    if (titleError) {
      throw new Error(`Failed to update land_titles: ${titleError.message}`);
    }

    // Step 3 — Revert associated parcels
    const { error: parcelError } = await this.supabase.raw
      .from('parcels')
      .update({ status: 'reverted' })
      .eq('token_id', tokenId);

    if (parcelError) {
      throw new Error(`Failed to update parcels: ${parcelError.message}`);
    }

    // Step 4 — Audit trail
    await this.auditService.record({
      entityId: tokenId,
      actorId: governorId,
      action: 'STATUTORY_REVOCATION',
      outcome: 'REVOKED',
      metadata: { ground, txHash },
    });

    // Step 5 — MQTT event (QoS 2, as defined in MQTT_TOPICS.TITLE_REVOKED)
    await this.mqttService.publish(
      MQTT_TOPICS.TITLE_REVOKED.topic,
      {
        tokenId,
        ground,
        revokedBy: governorId,
        timestamp: new Date().toISOString(),
      },
      2,
    );

    // Step 6 — Out-of-band notification (stub)
    await this.notificationService.notifyRevocation(tokenId, ground);
  }
}
