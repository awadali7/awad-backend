import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService, currentCycle } from './bills.service';

type BillRow = {
  id: string;
  adminUserId: string;
  name: string;
  installmentsPaid: number | null;
  installmentsTotal: number | null;
  installmentsLeft: number | null;
  startCycle: string | null;
  lastPaidCycle: string | null;
};

const bill = (overrides: Partial<BillRow> = {}): BillRow => ({
  id: 'bill-1',
  adminUserId: 'admin-1',
  name: 'Test bill',
  installmentsPaid: null,
  installmentsTotal: null,
  installmentsLeft: null,
  startCycle: null,
  lastPaidCycle: null,
  ...overrides,
});

describe('BillsService', () => {
  let billsService: BillsService;
  const prisma = {
    bill: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Echo the patch back so assertions can read the data that was written.
    prisma.bill.update.mockImplementation(
      (args: { where: { id: string }; data: Partial<BillRow> }) =>
        Promise.resolve({ ...args.where, ...args.data }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [BillsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    billsService = moduleRef.get(BillsService);
  });

  describe('markPaid', () => {
    it('counts up a paid/total bill and records the cycle', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({ installmentsPaid: 1, installmentsTotal: 12 }),
      );

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result).toMatchObject({
        installmentsPaid: 2,
        lastPaidCycle: '2026-09',
      });
    });

    it('counts down a "N left" chit', async () => {
      prisma.bill.findFirst.mockResolvedValue(bill({ installmentsLeft: 2 }));

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result).toMatchObject({
        installmentsLeft: 1,
        lastPaidCycle: '2026-09',
      });
    });

    it('only records the cycle for open-ended bills like rent', async () => {
      prisma.bill.findFirst.mockResolvedValue(bill());

      await billsService.markPaid('bill-1', 'admin-1', '2026-09');

      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { lastPaidCycle: '2026-09' },
      });
    });

    it('is idempotent — paying the same cycle twice does not double-count', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({
          installmentsPaid: 2,
          installmentsTotal: 12,
          lastPaidCycle: '2026-09',
        }),
      );

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(prisma.bill.update).not.toHaveBeenCalled();
      expect(result.installmentsPaid).toBe(2);
    });

    it('never counts past the total', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({ installmentsPaid: 12, installmentsTotal: 12 }),
      );

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result.installmentsPaid).toBe(12);
    });

    it('never counts a chit below zero', async () => {
      prisma.bill.findFirst.mockResolvedValue(bill({ installmentsLeft: 0 }));

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result.installmentsLeft).toBe(0);
    });

    it('defaults to the current cycle', async () => {
      prisma.bill.findFirst.mockResolvedValue(bill());

      const result = await billsService.markPaid('bill-1', 'admin-1');

      expect(result.lastPaidCycle).toBe(currentCycle());
    });
  });

  describe('startCycle', () => {
    it('refuses to settle a cycle before the bill starts', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({ startCycle: '2026-11', installmentsTotal: 12 }),
      );

      await expect(
        billsService.markPaid('bill-1', 'admin-1', '2026-10'),
      ).rejects.toThrow(/does not start until 2026-11/);
      expect(prisma.bill.update).not.toHaveBeenCalled();
    });

    it('allows the first billed cycle itself', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({
          startCycle: '2026-11',
          installmentsPaid: 0,
          installmentsTotal: 12,
        }),
      );

      const result = await billsService.markPaid(
        'bill-1',
        'admin-1',
        '2026-11',
      );

      expect(result).toMatchObject({
        installmentsPaid: 1,
        lastPaidCycle: '2026-11',
      });
    });

    it('allows any cycle after the start', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({
          startCycle: '2026-11',
          installmentsPaid: 1,
          installmentsTotal: 12,
        }),
      );

      await expect(
        billsService.markPaid('bill-1', 'admin-1', '2027-03'),
      ).resolves.toMatchObject({ lastPaidCycle: '2027-03' });
    });

    it('leaves bills with no start cycle unrestricted', async () => {
      prisma.bill.findFirst.mockResolvedValue(bill({ startCycle: null }));

      await expect(
        billsService.markPaid('bill-1', 'admin-1', '2020-01'),
      ).resolves.toMatchObject({ lastPaidCycle: '2020-01' });
    });
  });

  describe('owner scoping', () => {
    it("only lists the signed-in operator's bills", async () => {
      prisma.bill.findMany.mockResolvedValue([]);

      await billsService.findAll('admin-1');

      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adminUserId: 'admin-1' } }),
      );
    });

    it("hides another operator's bill behind the same 404 as a missing one", async () => {
      // findFirst with both id AND owner returns null for someone else's row.
      prisma.bill.findFirst.mockResolvedValue(null);

      await expect(billsService.findOne('bill-1', 'admin-2')).rejects.toThrow(
        /not found/,
      );
      expect(prisma.bill.findFirst).toHaveBeenCalledWith({
        where: { id: 'bill-1', adminUserId: 'admin-2' },
      });
    });

    it('refuses to let an upsert overwrite a bill owned by someone else', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({ adminUserId: 'admin-1' }),
      );

      await expect(
        billsService.upsert(
          'bill-1',
          {
            name: 'HIJACKED',
            category: 'x',
            type: 'emi',
            amount: 1,
          },
          'admin-2',
        ),
      ).rejects.toThrow(/not found/);
      expect(prisma.bill.upsert).not.toHaveBeenCalled();
    });

    it('stamps a newly created bill with its owner', async () => {
      prisma.bill.findUnique.mockResolvedValue(null);
      prisma.bill.upsert.mockImplementation(
        (args: { create: Record<string, unknown> }) =>
          Promise.resolve(args.create),
      );

      const created = await billsService.upsert(
        'new-bill',
        { name: 'Loan', category: 'EMI', type: 'emi', amount: 500 },
        'admin-2',
      );

      expect(created).toMatchObject({ adminUserId: 'admin-2' });
    });

    it('will not settle a bill belonging to someone else', async () => {
      prisma.bill.findFirst.mockResolvedValue(null);

      await expect(
        billsService.markPaid('bill-1', 'admin-2', '2026-10'),
      ).rejects.toThrow(/not found/);
      expect(prisma.bill.update).not.toHaveBeenCalled();
    });

    it('will not delete a bill belonging to someone else', async () => {
      prisma.bill.findFirst.mockResolvedValue(null);

      await expect(billsService.remove('bill-1', 'admin-2')).rejects.toThrow(
        /not found/,
      );
      expect(prisma.bill.delete).not.toHaveBeenCalled();
    });
  });

  describe('markUnpaid', () => {
    it('reverses a paid/total bill', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({
          installmentsPaid: 2,
          installmentsTotal: 12,
          lastPaidCycle: '2026-09',
        }),
      );

      const result = await billsService.markUnpaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result).toMatchObject({
        installmentsPaid: 1,
        lastPaidCycle: null,
      });
    });

    it('reverses a "N left" chit', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({ installmentsLeft: 1, lastPaidCycle: '2026-09' }),
      );

      const result = await billsService.markUnpaid(
        'bill-1',
        'admin-1',
        '2026-09',
      );

      expect(result).toMatchObject({
        installmentsLeft: 2,
        lastPaidCycle: null,
      });
    });

    it('leaves a different cycle alone', async () => {
      prisma.bill.findFirst.mockResolvedValue(
        bill({
          installmentsPaid: 5,
          installmentsTotal: 12,
          lastPaidCycle: '2026-08',
        }),
      );

      await billsService.markUnpaid('bill-1', 'admin-1', '2026-09');

      expect(prisma.bill.update).not.toHaveBeenCalled();
    });
  });
});
