import { Module } from '@nestjs/common';
import { RegistrationPipelineService } from './registration-pipeline.service';
import { SpatialModule } from '../spatial/spatial.module';
import { OracleModule } from '../oracle/oracle.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { AuditModule } from '../audit/audit.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SpatialModule, OracleModule, BlockchainModule, MqttModule, AuditModule, SupabaseModule],
  providers: [RegistrationPipelineService],
  exports: [RegistrationPipelineService],
})
export class PipelineModule {}
