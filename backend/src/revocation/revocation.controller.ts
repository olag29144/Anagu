import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { RequestWithUser } from '../auth/request-with-user.interface';
import { RevocationService, RevocationGround } from './revocation.service';

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

class RevokeDto {
  ground!: RevocationGround;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * REST controller for statutory land title revocation.
 *
 * Endpoint: `POST /titles/:tokenId/revoke`
 * Required role: `governor` (Requirement 4.7)
 *
 * References: Requirements 4.7, 4.8, 4.9
 */
@Controller('titles')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.GOVERNOR)
export class RevocationController {
  constructor(
    private readonly revocationService: RevocationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Revoke a land title on statutory grounds.
   *
   * Reads `governorId` from the authenticated request user and
   * `GOVERNOR_PRIVATE_KEY` from application config.
   *
   * @returns 200 OK with `{ success, tokenId, ground, revokedAt }`.
   */
  @Post(':tokenId/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('tokenId') tokenId: string,
    @Body() dto: RevokeDto,
    @Req() req: RequestWithUser,
  ): Promise<{
    success: boolean;
    tokenId: string;
    ground: RevocationGround;
    revokedAt: string;
  }> {
    const governorId: string = req.user?.id ?? 'system';
    const governorPrivateKey =
      this.configService.getOrThrow<string>('GOVERNOR_PRIVATE_KEY');

    await this.revocationService.revoke(
      tokenId,
      dto.ground,
      governorId,
      governorPrivateKey,
    );

    return {
      success: true,
      tokenId,
      ground: dto.ground,
      revokedAt: new Date().toISOString(),
    };
  }
}
