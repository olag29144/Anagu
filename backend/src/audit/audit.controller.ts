import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':entityId')
  @Roles(UserRole.REGISTRAR, UserRole.LAND_ADMIN, UserRole.GOVERNOR)
  async getTrail(@Param('entityId') entityId: string) {
    return this.auditService.getTrail(entityId);
  }
}
