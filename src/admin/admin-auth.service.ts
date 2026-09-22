import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const username = dto.username.toLowerCase().trim();
    const admin = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    // One message for "no such user" and "wrong password" so the endpoint
    // can't be used to enumerate valid usernames.
    const genericError = new UnauthorizedException(
      'Invalid username or password',
    );
    if (!admin) {
      // Spend roughly the same time as a real compare would, so a missing
      // username isn't detectable by response latency.
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw genericError;
    }

    const matches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!matches) throw genericError;

    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.jwt.sign({
      sub: admin.id,
      username: admin.username,
      role: 'admin',
    });
    return { accessToken, admin: toPublicAdmin(updated) };
  }

  async me(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin)
      throw new UnauthorizedException('Admin account no longer exists');
    return toPublicAdmin(admin);
  }

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin)
      throw new UnauthorizedException('Admin account no longer exists');

    const matches = await bcrypt.compare(
      dto.currentPassword,
      admin.passwordHash,
    );
    if (!matches)
      throw new UnauthorizedException('Current password is incorrect');

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS),
      },
    });
    return { ok: true };
  }
}

/** A real bcrypt hash of a value nothing can match — used only for timing parity. */
const DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function toPublicAdmin(admin: {
  id: string;
  username: string;
  name: string | null;
  lastLoginAt: Date | null;
}) {
  return {
    id: admin.id,
    username: admin.username,
    name: admin.name,
    lastLoginAt: admin.lastLoginAt,
  };
}
