import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../supabase/supabase-client.service';

export interface AuditEntry {
  /** Application ID or token ID — the subject of the workflow action. */
  entityId: string;
  /** Supabase auth user UUID; omitted for system-initiated actions. */
  actorId?: string;
  /** Workflow action name, e.g. 'SPATIAL_VERIFICATION', 'REGISTRAR_APPROVAL'. */
  action: string;
  /** Outcome string, e.g. 'APPROVED', 'REJECTED', 'REVOKED'. */
  outcome: string;
  /** Optional structured data to attach to the entry. */
  metadata?: Record<string, unknown>;
}

interface AuditTrailRow {
  entity_id: string;
  actor_id: string | null;
  action: string;
  outcome: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseClientService) {}

  /**
   * Append a new entry to the audit trail.
   * Only INSERT is ever called on this table — no updates or deletes (Req 8.2, 8.5).
   */
  async record(entry: AuditEntry): Promise<void> {
    const row: AuditTrailRow = {
      entity_id: entry.entityId,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      outcome: entry.outcome,
      metadata: entry.metadata ?? {},
      created_at: new Date().toISOString(),
    };

    const { error } = await this.supabase.raw
      .from('audit_trail')
      .insert(row);

    if (error) {
      throw new Error(`Audit write failed: ${error.message}`);
    }
  }

  /**
   * Retrieve the full ordered audit history for a given entity.
   * Returns entries sorted by created_at ascending (oldest first).
   */
  async getTrail(entityId: string): Promise<AuditEntry[]> {
    const { data, error } = await this.supabase.raw
      .from('audit_trail')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Audit read failed: ${error.message}`);
    }

    const rows = (data ?? []) as AuditTrailRow[];
    return rows.map((row) => ({
      entityId: row.entity_id,
      ...(row.actor_id !== null && { actorId: row.actor_id }),
      action: row.action,
      outcome: row.outcome,
      metadata: row.metadata,
    }));
  }
}
