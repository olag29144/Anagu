import { Injectable, Logger } from '@nestjs/common';

export interface InstitutionalRecord {
  parcelRef: string;
  activeOwnerName: string;
  documentNumber: string;
  legalHold: boolean;
}

@Injectable()
export class InstitutionalSourceClient {
  private readonly logger = new Logger(InstitutionalSourceClient.name);

  async fetchRecord(parcelRef: string): Promise<InstitutionalRecord | null> {
    this.logger.debug(`Fetching institutional record for parcel: ${parcelRef}`);
    // Production: HTTP call to external land registry API
    // Prototype: returns null (no conflicting record found)
    return null;
  }
}
