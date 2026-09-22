import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { RequestWithUser } from '../auth/request-with-user.interface';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { AuditService } from '../audit/audit.service';
import { RegistrationPipelineService } from '../pipeline/registration-pipeline.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly audit: AuditService,
    private readonly pipeline: RegistrationPipelineService,
  ) {}

  @Post()
  @Roles(UserRole.CITIZEN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateApplicationDto, @Req() req: RequestWithUser) {
    const citizenId = req.user.id;
    const { data, error } = await this.supabase.raw.from('applications').insert({
      citizen_id: citizenId,
      owner_name: dto.ownerName,
      owner_wallet_address: dto.ownerWalletAddress,
      document_number: dto.documentNumber,
      document_type: dto.documentType,
      issuing_authority: dto.issuingAuthority,
      parcel_ref: dto.parcelRef,
      parcel_ring: dto.parcelRing,
      title_metadata_uri: dto.titleMetadataUri ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error || !data) throw new Error(`Failed to create application: ${error?.message}`);

    // Fire-and-forget pipeline (don't block the HTTP response)
    void this.pipeline.run((data as { id: string }).id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      void this.audit.record({ entityId: (data as { id: string }).id, action: 'PIPELINE_ERROR', outcome: msg });
    });

    return {
      id: (data as { id: string }).id,
      status: 'pending',
      createdAt: (data as { created_at: string }).created_at,
    };
  }

  @Get()
  @Roles(UserRole.REGISTRAR, UserRole.LAND_ADMIN)
  async findAll() {
    const { data, error } = await this.supabase.raw
      .from('applications').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch applications: ${error.message}`);
    return data ?? [];
  }

  @Get(':id')
  @Roles(UserRole.CITIZEN, UserRole.REGISTRAR, UserRole.LAND_ADMIN)
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const { data, error } = await this.supabase.raw
      .from('applications').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundException(`Application ${id} not found`);
    const row = data as { citizen_id: string };
    if (req.user.role === UserRole.CITIZEN && row.citizen_id !== req.user.id) {
      throw new ForbiddenException('You can only view your own applications');
    }
    return data;
  }

  @Post(':id/approve')
  @Roles(UserRole.REGISTRAR)
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.pipeline.completeAfterRegistrarApproval(id, req.user.id);
    return { success: true, applicationId: id };
  }

  @Post(':id/reject')
  @Roles(UserRole.REGISTRAR)
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string, @Req() req: RequestWithUser) {
    const { error } = await this.supabase.raw
      .from('applications')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Failed to reject application: ${error.message}`);
    await this.audit.record({
      entityId: id,
      actorId: req.user.id,
      action: 'REGISTRAR_REJECTION',
      outcome: 'REJECTED',
    });
    return { success: true, applicationId: id };
  }
}
