import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit/audit.service';
import { RequestWithUser } from './request-with-user.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap({
        /**
         * On any thrown exception the NestJS exception filter handles the
         * response *after* this interceptor's tap completes. We therefore
         * capture 403s by catching errors here and re-throwing them so the
         * normal filter still processes them.
         */
        error: (err: unknown) => {
          const status = this.getStatus(err);

          if (status === 403) {
            const request = context
              .switchToHttp()
              .getRequest<RequestWithUser>();

            const user = request.user;

            // Best-effort audit write — do not mask the original error
            void this.auditService
              .record({
                entityId: 'RBAC_VIOLATION',
                actorId:  user?.id,
                action:   'UNAUTHORISED_ACCESS',
                outcome:  request.url,
                metadata: {
                  method:   request.method,
                  userRole: user?.role ?? 'unknown',
                },
              })
              .catch(() => {
                // Swallowed intentionally
              });
          }
        },
      }),
    );
  }

  private getStatus(err: unknown): number | null {
    if (
      err !== null &&
      typeof err === 'object' &&
      'getStatus' in err &&
      typeof (err as { getStatus: () => number }).getStatus === 'function'
    ) {
      return (err as { getStatus: () => number }).getStatus();
    }
    return null;
  }
}
