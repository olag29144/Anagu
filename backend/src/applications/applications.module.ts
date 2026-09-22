import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuditModule, PipelineModule, AuthModule],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
