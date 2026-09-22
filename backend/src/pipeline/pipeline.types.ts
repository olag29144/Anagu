/**
 * Pipeline stage identifiers — ordered as they appear in the registration workflow.
 * Requirements 9.1, 9.2, 9.3
 */
export type PipelineStage =
  | 'SPATIAL_VERIFICATION'
  | 'ORACLE_VERIFICATION'
  | 'LEGAL_VERIFICATION'
  | 'REGISTRAR_APPROVAL'
  | 'BLOCKCHAIN_REGISTRATION'
  | 'NFT_ISSUANCE'
  | 'MQTT_NOTIFICATION';

/** Lifecycle states of a land-registration application. */
export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'completed';

/**
 * Shape of a row read from the `applications` Supabase table.
 * All fields are stored in snake_case as they come back from the DB.
 */
export interface ApplicationRecord {
  id: string;
  citizen_id: string;
  owner_name: string;
  owner_wallet_address: string;
  document_number: string;
  document_type: string;
  issuing_authority: string;
  parcel_ref: string;
  spatial_hash: string | null;
  title_metadata_uri: string | null;
  status: ApplicationStatus;
  /** GeoJSON-style ring supplied on submission. */
  parcel_ring?: { coordinates: [number, number][] };
}
