import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SpatialService } from './spatial.service';
import { SpatialController } from './spatial.controller';

/**
 * NestJS module for GIS-based spatial verification.
 * Requirement 2 — exposes `SpatialService` and `POST /parcels/validate`.
 */
@Module({
  imports: [SupabaseModule, AuditModule, AuthModule],
  providers: [SpatialService],
  controllers: [SpatialController],
  exports: [SpatialService],
})
export class SpatialModule {}
