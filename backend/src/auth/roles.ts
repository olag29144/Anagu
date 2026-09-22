import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  CITIZEN    = 'citizen',
  SURVEYOR   = 'surveyor',
  REGISTRAR  = 'registrar',
  LAND_ADMIN = 'land_admin',
  GOVERNOR   = 'governor',
}

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const RBAC_MATRIX: Record<string, UserRole[]> = {
  'application:submit':        [UserRole.CITIZEN],
  'application:view:own':      [UserRole.CITIZEN],
  'application:view:all':      [UserRole.REGISTRAR, UserRole.LAND_ADMIN],
  'parcel:coordinates:submit': [UserRole.SURVEYOR],
  'parcel:geometry:validate':  [UserRole.SURVEYOR],
  'application:approve':       [UserRole.REGISTRAR],
  'application:reject':        [UserRole.REGISTRAR],
  'blockchain:register':       [UserRole.REGISTRAR],
  'nft:issue':                 [UserRole.REGISTRAR],
  'registry:manage':           [UserRole.LAND_ADMIN],
  'audit:view':                [UserRole.REGISTRAR, UserRole.LAND_ADMIN, UserRole.GOVERNOR],
  'revocation:invoke':         [UserRole.GOVERNOR],
};
