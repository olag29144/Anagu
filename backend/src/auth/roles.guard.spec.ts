import * as fc from 'fast-check';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { RBAC_MATRIX, UserRole } from './roles';
import { RolesGuard } from './roles.guard';
import { RequestWithUser } from './request-with-user.interface';

describe('RolesGuard RBAC property', () => {
  const operations = Object.keys(RBAC_MATRIX);
  const roles = Object.values(UserRole);
  let auditMock: { record: jest.Mock };
  let guard: RolesGuard;
  let request: Partial<RequestWithUser>;
  let requiredRoles: UserRole[];

  beforeEach(() => {
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    const reflectorMock = {
      getAllAndOverride: jest.fn(() => requiredRoles),
    };
    guard = new RolesGuard(
      reflectorMock as unknown as Reflector,
      auditMock as unknown as AuditService,
    );
    request = {
      url: '/rbac/property-test',
      method: 'GET',
      user: {
        id: 'user-001',
        role: UserRole.CITIZEN,
        email: 'user@example.test',
      },
    } as Partial<RequestWithUser>;
  });

  it('allows exactly the roles listed for every operation in RBAC_MATRIX', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...operations),
        fc.constantFrom(...roles),
        async (operation, role) => {
          requiredRoles = RBAC_MATRIX[operation];
          request.user = {
            id: 'user-001',
            role,
            email: 'user@example.test',
          };
          auditMock.record.mockClear();

          const context = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({ getRequest: () => request }),
          } as unknown as ExecutionContext;
          const expectedAllowed = RBAC_MATRIX[operation].includes(role);

          if (expectedAllowed) {
            await expect(guard.canActivate(context)).resolves.toBe(true);
            expect(auditMock.record).not.toHaveBeenCalled();
          } else {
            await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
              ForbiddenException,
            );
            expect(auditMock.record).toHaveBeenCalledWith(
              expect.objectContaining({
                action: 'UNAUTHORISED_ACCESS',
                actorId: 'user-001',
              }),
            );
          }
        },
      ),
      { numRuns: operations.length * roles.length },
    );
  });
});
