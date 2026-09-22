import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseClientService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseClientService.name);
  private client!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify connection by running a lightweight health probe
    void this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      // Use a simple system-level query that works without application tables
      const { error } = await this.client
        .from('_pgsodium_key')
        .select('id')
        .limit(1);

      // If the table doesn't exist that's fine — it still confirms auth works
      if (error && error.code !== '42P01' && error.code !== 'PGRST116') {
        this.logger.warn(`Supabase probe returned: ${error.message}`);
      } else {
        this.logger.log('Supabase PostgreSQL connected');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Supabase connection probe failed: ${message}`);
    }
  }

  /**
   * Proxy to the underlying Supabase `from()` query builder.
   * Returns the raw PostgrestQueryBuilder for the given table.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): ReturnType<SupabaseClient['from']> {
    return this.client.from(table);
  }

  /**
   * Proxy to the underlying Supabase `rpc()` method.
   * Calls a named Postgres function with optional arguments.
   */
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): ReturnType<SupabaseClient['rpc']> {
    return this.client.rpc(fn, args);
  }

  /** Expose the raw client for advanced use-cases (storage, realtime, etc.) */
  get raw(): SupabaseClient {
    return this.client;
  }
}
