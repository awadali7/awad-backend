import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BorrowingsService } from './borrowings.service';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  adminUserId: 'admin-1',
  lender: 'Rahul',
  amount: 25_000,
  startDate: new Date('2026-10-02'),
  dueDate: new Date('2027-01-15'),
  repaidOn: null,
  ...overrides,
});

describe('BorrowingsService', () => {
  let borrowingsService: BorrowingsService;
  const prisma = {
    borrowing: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.borrowing.update.mockImplementation(
      (args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ ...args.where, ...args.data }),
    );
    prisma.borrowing.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve(args.data),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BorrowingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    borrowingsService = moduleRef.get(BorrowingsService);
  });

  describe('create', () => {
    it('rejects a due date before the start date', async () => {
      await expect(
        borrowingsService.create(
          {
            lender: 'Rahul',
            amount: 1000,
            startDate: '2026-10-10',
            dueDate: '2026-10-01',
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.borrowing.create).not.toHaveBeenCalled();
    });

    it('accepts a due date equal to the start date', async () => {
      await expect(
        borrowingsService.create(
          {
            lender: 'Rahul',
            amount: 1000,
            startDate: '2026-10-10',
            dueDate: '2026-10-10',
          },
          'admin-1',
        ),
      ).resolves.toBeDefined();
    });

    it('trims the lender and stores no repayment date by default', async () => {
      const created = await borrowingsService.create(
        {
          lender: '  Rahul  ',
          amount: 1000,
          startDate: '2026-10-10',
          dueDate: '2026-11-10',
        },
        'admin-1',
      );

      expect(created).toMatchObject({
        lender: 'Rahul',
        repaidOn: null,
        adminUserId: 'admin-1',
      });
    });
  });

  describe('findAll', () => {
    it('totals outstanding separately from repaid', async () => {
      prisma.borrowing.findMany.mockResolvedValue([
        row({ id: 'a', amount: 25_000 }),
        row({ id: 'b', amount: 5_000, repaidOn: new Date('2026-11-01') }),
      ]);

      const result = await borrowingsService.findAll('admin-1');

      expect(result.outstandingTotal).toBe(25_000);
      expect(result.repaidTotal).toBe(5_000);
      expect(result.outstandingCount).toBe(1);
    });

    it('counts an unpaid borrowing past its due date as overdue', async () => {
      prisma.borrowing.findMany.mockResolvedValue([
        row({ id: 'late', dueDate: new Date('2020-01-01') }),
        // Past due but settled — must not count.
        row({
          id: 'settled',
          dueDate: new Date('2020-01-01'),
          repaidOn: new Date('2020-02-01'),
        }),
        row({ id: 'future', dueDate: new Date('2099-01-01') }),
      ]);

      expect((await borrowingsService.findAll('admin-1')).overdueCount).toBe(1);
    });
  });

  describe('markRepaid', () => {
    it('defaults the settlement date to today', async () => {
      prisma.borrowing.findFirst.mockResolvedValue(row());

      const result = await borrowingsService.markRepaid('b1', 'admin-1');

      expect(result.repaidOn).toBeInstanceOf(Date);
    });

    it('uses an explicit date when given', async () => {
      prisma.borrowing.findFirst.mockResolvedValue(row());

      const result = await borrowingsService.markRepaid(
        'b1',
        'admin-1',
        '2026-12-20',
      );

      expect((result.repaidOn as Date).toISOString()).toContain('2026-12-20');
    });

    it('can be undone', async () => {
      prisma.borrowing.findFirst.mockResolvedValue(
        row({ repaidOn: new Date('2026-12-20') }),
      );

      expect(
        (await borrowingsService.markOutstanding('b1', 'admin-1')).repaidOn,
      ).toBeNull();
    });
  });
});
