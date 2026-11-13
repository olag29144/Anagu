import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { OracleService } from './oracle.service';
import { OwnershipClaim, VerificationResult } from './oracle.types';
import { InstitutionalRecord } from './institutional-source.client';
import { CommunityRecord } from './community-source.client';

class VerifyOracleDto {
  claim!: OwnershipClaim;
  evaluationRecord?: Pick<
    InstitutionalRecord,
    'activeOwnerName' | 'documentNumber' | 'legalHold'
  >;
  evaluationCommunityRecord?: CommunityRecord;
}

/**
 * REST controller exposing community & institutional ownership verification.
 *
 * Endpoint: `POST /oracle/verify`
 * Required role: `registrar` or `land_admin`
 */
@Controller('oracle')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.REGISTRAR, UserRole.LAND_ADMIN)
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyOracleDto): Promise<VerificationResult> {
    return this.oracleService.verify(
      dto.claim,
      dto.evaluationRecord,
      dto.evaluationCommunityRecord,
    );
  }
}
