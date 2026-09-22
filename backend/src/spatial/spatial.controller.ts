import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, UserRole } from '../auth/roles';
import { SpatialService } from './spatial.service';
import {
  SpatialVerificationDto,
  SpatialVerificationResult,
} from './dto/spatial-verification.dto';

/**
 * REST controller for parcel spatial validation.
 *
 * Endpoint: `POST /parcels/validate`
 * Required role: `surveyor` (Requirement 7.4)
 *
 * HTTP status codes (design error-handling table, Req 2.4–2.6):
 *  200 OK                   — `outcome: 'approved'`
 *  409 Conflict             — `outcome: 'rejected_overlap'`    (PARCEL_OVERLAP)
 *  422 Unprocessable Entity — `outcome: 'rejected_invalid_geometry'` (GEOM_INVALID)
 */
@Controller('parcels')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SURVEYOR)
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  /**
   * Validate submitted parcel coordinates.
   *
   * Returns 200 on approval. Throws HTTP 422 for invalid geometry and
   * HTTP 409 for overlap — both with the full `SpatialVerificationResult`
   * payload in the response body so callers can read diagnostic codes.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(
    @Body() dto: SpatialVerificationDto,
  ): Promise<SpatialVerificationResult> {
    const result = await this.spatialService.verifySpatial(dto);

    switch (result.outcome) {
      case 'rejected_invalid_geometry':
        throw new HttpException(result, HttpStatus.UNPROCESSABLE_ENTITY);

      case 'rejected_overlap':
        throw new HttpException(result, HttpStatus.CONFLICT);

      case 'approved':
      default:
        return result;
    }
  }
}
