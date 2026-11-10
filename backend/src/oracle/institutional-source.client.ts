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

  private readonly fixtureRecords = new Map<string, InstitutionalRecord>([
    [
      'ABUJA/2024/001',
      {
        parcelRef: 'ABUJA/2024/001',
        activeOwnerName: 'Emeka Okonkwo',
        documentNumber: 'DOC-12345',
        legalHold: false,
      },
    ],
    [
      'ABUJA/2024/002',
      {
        parcelRef: 'ABUJA/2024/002',
        activeOwnerName: 'Aisha Yusuf',
        documentNumber: 'DOC-67890',
        legalHold: false,
      },
    ],
  ]);

  async fetchRecord(parcelRef: string): Promise<InstitutionalRecord | null> {
    this.logger.debug(`Fetching institutional record for parcel: ${parcelRef}`);

    const registryUrl = process.env.ANAGU_INSTITUTION_REGISTRY_URL;
    if (registryUrl) {
      try {
        const response = await fetch(registryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parcelRef }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as Partial<InstitutionalRecord> | null;
        if (!payload || typeof payload.activeOwnerName !== 'string') {
          return null;
        }

        return {
          parcelRef,
          activeOwnerName: payload.activeOwnerName,
          documentNumber: payload.documentNumber ?? '',
          legalHold: Boolean(payload.legalHold),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Institutional registry lookup failed for ${parcelRef}; falling back to mock fixture. ${message}`,
        );
      }
    }

    return this.fixtureRecords.get(parcelRef) ?? null;
  }
}
