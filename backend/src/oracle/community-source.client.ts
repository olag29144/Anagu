import { Injectable, Logger } from '@nestjs/common';

export interface CommunityRecord {
  parcelRef: string;
  communityAttestations: string[];
}

@Injectable()
export class CommunitySourceClient {
  private readonly logger = new Logger(CommunitySourceClient.name);

  async fetchRecord(parcelRef: string): Promise<CommunityRecord | null> {
    this.logger.debug(`Fetching community record for parcel: ${parcelRef}`);
    return null;
  }
}
