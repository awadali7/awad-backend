import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  describe('signup', () => {
    it('stores a bcrypt hash, not the plaintext password', async () => {
      let capturedPasswordHash = '';
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        (args: {
          data: { email: string; passwordHash: string; name?: string };
        }) => {
          capturedPasswordHash = args.data.passwordHash;
          return Promise.resolve({
            id: 'user-1',
            email: args.data.email,
            name: args.data.name ?? null,
          });
        },
      );

      await authService.signup({
        email: 'a@test.com',
        password: 'plaintext123',
      });

      expect(capturedPasswordHash).not.toBe('plaintext123');
      expect(await bcrypt.compare('plaintext123', capturedPasswordHash)).toBe(
        true,
      );
    });

    it('throws ConflictException when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        authService.signup({ email: 'a@test.com', password: 'plaintext123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns a token whose payload matches the created user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        name: null,
      });

      const result = await authService.signup({
        email: 'a@test.com',
        password: 'plaintext123',
      });

      const decoded = jwtService.verify<{ sub: string; email: string }>(
        result.accessToken,
      );
      expect(decoded.sub).toBe('user-1');
      expect(decoded.email).toBe('a@test.com');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        passwordHash: await bcrypt.hash('correct-password', 10),
      });

      await expect(
        authService.login({ email: 'a@test.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@test.com', password: 'anything' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
