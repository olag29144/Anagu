import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClientService } from '../supabase/supabase-client.service';

export interface CommunityRecord {
  parcelRef: string;
  communityAttestations: string[];
}

@Injectable()
export class CommunitySourceClient {
  private readonly logger = new Logger(CommunitySourceClient.name);

  constructor(private readonly supabase: SupabaseClientService) {}

  async fetchRecord(parcelRef: string): Promise<CommunityRecord | null> {
    this.logger.debug(`Fetching community record for parcel: ${parcelRef}`);
    const { data, error } = await this.supabase.raw
      .from('community_attestations')
      .select('attestation')
      .eq('parcel_ref', parcelRef);

    if (error) {
      throw new Error(
        `Failed to fetch community attestations for parcel "${parcelRef}": ${error.message}`,
      );
    }

    const communityAttestations = (data ?? []).flatMap((row) =>
      typeof row.attestation === 'string' ? [row.attestation] : [],
    );
    if (communityAttestations.length === 0) {
      return null;
    }

    return { parcelRef, communityAttestations };
  }
}
