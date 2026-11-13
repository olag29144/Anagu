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

class TransferDto {
  toWallet!: string;
  newOwnerId?: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * REST controller for statutory land title revocation & registry-controlled transfers.
 *
 * Endpoints:
 *   `POST /titles/:tokenId/revoke`   — Required role: `governor` (Requirement 4.7)
 *   `POST /titles/:tokenId/transfer` — Required role: `registrar` (Requirement 3.5)
 */
@Controller('titles')
@UseGuards(SupabaseAuthGuard, RolesGuard)
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
  @Roles(UserRole.GOVERNOR)
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

  /**
   * Registry-controlled ownership transfer via LandRegistry contract.
   */
  @Post(':tokenId/transfer')
  @Roles(UserRole.REGISTRAR)
  @HttpCode(HttpStatus.OK)
  async transfer(
    @Param('tokenId') tokenId: string,
    @Body() dto: TransferDto,
    @Req() req: RequestWithUser,
  ): Promise<{
    success: boolean;
    oldTokenId: string;
    newTokenId: string;
    from: string;
    to: string;
    txHash: string;
  }> {
    const registrarId: string = req.user?.id ?? 'system';
    const result = await this.revocationService.transferTitle(
      tokenId,
      dto.toWallet,
      registrarId,
      dto.newOwnerId,
    );

    return {
      success: true,
      ...result,
    };
  }
}
