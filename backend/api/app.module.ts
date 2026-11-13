import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../src/supabase/supabase.module';
import { HealthModule } from '../src/health/health.module';
import { AuditModule } from '../src/audit/audit.module';
import { SpatialModule } from '../src/spatial/spatial.module';
import { AuthModule } from '../src/auth/auth.module';
import { ApplicationsModule } from '../src/applications/applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    SupabaseModule,
    HealthModule,
    AuditModule,
    AuthModule,
    SpatialModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
