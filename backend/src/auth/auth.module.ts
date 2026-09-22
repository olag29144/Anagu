import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    AuditModule,
  ],
  providers: [
    SupabaseAuthGuard,
    RolesGuard,
    AuditInterceptor,
  ],
  exports: [
    SupabaseAuthGuard,
    RolesGuard,
    AuditInterceptor,
  ],
})
export class AuthModule {}
