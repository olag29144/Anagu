export interface CoordinateRing {
  coordinates: [number, number][];
}

export interface CreateApplicationDto {
  ownerName: string;
  ownerWalletAddress: string;
  documentNumber: string;
  documentType: string;
  issuingAuthority: string;
  parcelRef: string;
  parcelRing: CoordinateRing;
  titleMetadataUri?: string;
}
