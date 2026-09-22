import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { MqttModule } from './mqtt/mqtt.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { SpatialModule } from './spatial/spatial.module';
import { RevocationModule } from './revocation/revocation.module';
import { AuthModule } from './auth/auth.module';
import { OracleModule } from './oracle/oracle.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ApplicationsModule } from './applications/applications.module';
import { BaselineModule } from './baseline/baseline.module';
import { EvaluationModule } from './evaluation/evaluation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    SupabaseModule,
    HealthModule,
    AuditModule,
    AuthModule,
    MqttModule,
    BlockchainModule,
    SpatialModule,
    RevocationModule,
    OracleModule,
    PipelineModule,
    ApplicationsModule,
    BaselineModule,
    EvaluationModule,
  ],
})
export class AppModule {}
