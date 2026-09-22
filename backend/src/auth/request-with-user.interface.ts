import { Request } from 'express';
import { UserRole } from './roles';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
