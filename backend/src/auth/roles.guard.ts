import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { ROLES_KEY, UserRole } from './roles';
import { RequestWithUser } from './request-with-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read the @Roles(...) metadata from the handler, then the class
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles metadata — allow access (guard is a no-op for unprotected routes)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user && requiredRoles.includes(user.role)) {
      return true;
    }

    // Record the unauthorised attempt in the audit trail (best-effort — do not
    // let an audit write failure mask the 403 response)
    if (user) {
      void this.auditService
        .record({
          entityId: 'RBAC_VIOLATION',
          actorId:  user.id,
          action:   'UNAUTHORISED_ACCESS',
          outcome:  request.url,
          metadata: {
            userRole:      user.role,
            requiredRoles,
            method:        request.method,
          },
        })
        .catch(() => {
          // Intentionally swallowed — audit failure must not suppress the 403
        });
    }

    throw new ForbiddenException(
      `Role '${user?.role ?? 'unknown'}' is not authorised to access this resource`,
    );
  }
}
