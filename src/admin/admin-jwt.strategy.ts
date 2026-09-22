import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export const ADMIN_JWT_STRATEGY = 'admin-jwt';

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthenticatedAdmin {
  id: string;
  username: string;
}

/**
 * Deliberately signed with its own secret (ADMIN_JWT_SECRET) rather than the
 * customer JWT_SECRET, so a storefront customer token can never be replayed
 * against an admin endpoint even if a guard is wired up carelessly. The `role`
 * check below is a second belt on the same trousers.
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(
  Strategy,
  ADMIN_JWT_STRATEGY,
) {
  constructor() {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new Error('ADMIN_JWT_SECRET is not configured on the server');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AdminJwtPayload): AuthenticatedAdmin {
    if (payload.role !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }
    return { id: payload.sub, username: payload.username };
  }
}
