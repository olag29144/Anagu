import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RevocationService } from './revocation.service';
import { NotificationService } from './notification.service';
import { RevocationController } from './revocation.controller';

/**
 * NestJS module for statutory land title revocation.
 *
 * Exposes `POST /titles/:tokenId/revoke` (governor role only) and
 * re-exports `RevocationService` for use by other modules (e.g. an admin
 * panel or a future batch-revocation workflow).
 *
 * References: Requirements 4.7, 4.8, 4.9
 */
@Module({
  imports: [
    BlockchainModule,
    AuditModule,
    AuthModule,
    MqttModule,
    SupabaseModule,
    ConfigModule,
  ],
  providers: [RevocationService, NotificationService],
  controllers: [RevocationController],
  exports: [RevocationService],
})
export class RevocationModule {}
