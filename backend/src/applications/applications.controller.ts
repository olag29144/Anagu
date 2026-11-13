import {
  Body,
  Controller,
  ConflictException,
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
    if (typeof (this.pipeline as { rejectApplication?: (id: string, actorId: string, reason?: string) => Promise<void> }).rejectApplication === 'function') {
      await this.pipeline.rejectApplication(id, req.user.id, 'Rejected by registrar');
      return { success: true, applicationId: id };
    }

    const { data, error } = await this.supabase.raw
      .from('applications')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'in_review')
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Failed to reject application: ${error.message}`);
    if (!data) {
      const { data: application, error: lookupError } = await this.supabase.raw
        .from('applications')
        .select('status')
        .eq('id', id)
        .maybeSingle();

      if (lookupError) {
        throw new Error(`Failed to check application status: ${lookupError.message}`);
      }
      if (!application) {
        throw new NotFoundException(`Application ${id} not found`);
      }
      throw new ConflictException(
        `Application ${id} cannot be rejected while it is ${application.status}; expected in_review`,
      );
    }

    await this.audit.record({
      entityId: id,
      actorId: req.user.id,
      action: 'REGISTRAR_REJECTION',
      outcome: 'REJECTED',
    });
    return { success: true, applicationId: id };
  }

  @Post(':id/cancel')
  @Roles(UserRole.CITIZEN)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (
      typeof (
        this.pipeline as {
          cancelApplication?: (appId: string, citizenId: string) => Promise<void>;
        }
      ).cancelApplication === 'function'
    ) {
      await this.pipeline.cancelApplication(id, req.user.id);
      return { success: true, applicationId: id, status: 'cancelled' };
    }

    const { data: existing, error: lookupError } = await this.supabase.raw
      .from('applications')
      .select('citizen_id, status')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to inspect application: ${lookupError.message}`);
    }
    if (!existing) {
      throw new NotFoundException(`Application ${id} not found`);
    }

    const row = existing as { citizen_id: string; status: string };
    if (row.citizen_id !== req.user.id) {
      throw new ForbiddenException('You can only cancel your own applications');
    }
    if (!['pending', 'legal_pending', 'in_review'].includes(row.status)) {
      throw new ConflictException(
        `Application ${id} cannot be cancelled while it is ${row.status}`,
      );
    }

    const { error: updateError } = await this.supabase.raw
      .from('applications')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to cancel application: ${updateError.message}`);
    }

    await this.audit.record({
      entityId: id,
      actorId: req.user.id,
      action: 'APPLICANT_CANCELLATION',
      outcome: 'CANCELLED',
    });
    return { success: true, applicationId: id, status: 'cancelled' };
  }
}
