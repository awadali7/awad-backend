import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtGuard } from './admin-jwt.guard';

/**
 * The household data has two legitimate callers:
 *  - machine callers (scripts, the notifier) holding the shared `x-api-key`
 *  - a signed-in operator on /admin, holding an admin bearer token
 *
 * A request only needs to satisfy one of them. The api-key branch is checked
 * first because it is a cheap string compare and never touches Passport.
 */
@Injectable()
export class ApiKeyOrAdminGuard implements CanActivate {
  constructor(private readonly adminJwtGuard: AdminJwtGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-api-key');
    const expected = process.env.API_KEY;

    if (!expected) {
      throw new Error('API_KEY is not configured on the server');
    }
    if (provided && provided === expected) {
      return true;
    }

    try {
      return (await this.adminJwtGuard.canActivate(context)) as boolean;
    } catch {
      throw new UnauthorizedException(
        'Provide a valid x-api-key or an admin bearer token',
      );
    }
  }
}
