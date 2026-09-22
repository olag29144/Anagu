import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, RemoteJWKSetOptions } from 'jose';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { UserRole } from './roles';
import { AuthenticatedUser, RequestWithUser } from './request-with-user.interface';

/** Extended JWT payload shape produced by Supabase Auth */
interface SupabaseJwtPayload extends JWTPayload {
  email?: string;
  user_role?: string;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseClientService,
  ) {
    const jwksUrl = this.config.getOrThrow<string>('SUPABASE_JWKS_URL');
    this.jwks = createRemoteJWKSet(
      new URL(jwksUrl),
      { cacheMaxAge: 600_000 } as RemoteJWKSetOptions,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request.headers['authorization'] as string | undefined);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: SupabaseJwtPayload;
    try {
      const result = await jwtVerify(token, this.jwks);
      payload = result.payload as SupabaseJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token is missing subject claim');
    }

    // Resolve the user's role — prefer JWT claim, fall back to user_roles table
    const role = await this.resolveRole(payload);
    if (!role) {
      throw new UnauthorizedException('User has no assigned role');
    }

    const user: AuthenticatedUser = {
      id: payload.sub,
      role,
      email: payload.email ?? '',
    };

    request.user = user;
    return true;
  }

  // ---------------------------------------------------------------------------

  private extractBearer(header?: string): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }

  private async resolveRole(payload: SupabaseJwtPayload): Promise<UserRole | null> {
    // 1. Try JWT claim first (fastest path — no extra DB round-trip)
    if (payload.user_role) {
      const role = payload.user_role as UserRole;
      if (Object.values(UserRole).includes(role)) {
        return role;
      }
    }

    // 2. Fall back to user_roles table using the subject (user id)
    const { data, error } = await this.supabase.raw
      .from('user_roles')
      .select('role')
      .eq('user_id', payload.sub as string)
      .single();

    if (error || !data) {
      return null;
    }

    const dbRole = (data as { role: string }).role as UserRole;
    return Object.values(UserRole).includes(dbRole) ? dbRole : null;
  }
}
