import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { OracleService } from './oracle.service';
import { InstitutionalSourceClient } from './institutional-source.client';
import { CommunitySourceClient } from './community-source.client';

/**
 * OracleModule — community & institutional ownership verification.
 * Requirements 5.1–5.8
 */
@Module({
  imports: [AuditModule, MqttModule],
  providers: [OracleService, InstitutionalSourceClient, CommunitySourceClient],
  exports: [OracleService, InstitutionalSourceClient, CommunitySourceClient],
})
export class OracleModule {}
