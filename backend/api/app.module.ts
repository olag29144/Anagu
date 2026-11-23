import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../src/supabase/supabase.module';
import { HealthModule } from '../src/health/health.module';
import { AuditModule } from '../src/audit/audit.module';
import { SpatialModule } from '../src/spatial/spatial.module';
import { AuthModule } from '../src/auth/auth.module';
import { ApplicationsModule } from '../src/applications/applications.module';
import { RevocationModule } from '../src/revocation/revocation.module';
import { BlockchainModule } from '../src/blockchain/blockchain.module';
import { OracleModule } from '../src/oracle/oracle.module';
import { PipelineModule } from '../src/pipeline/pipeline.module';

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
    SpatialModule,
    BlockchainModule,
    OracleModule,
    PipelineModule,
    ApplicationsModule,
    RevocationModule,
  ],
})
export class AppModule {}
