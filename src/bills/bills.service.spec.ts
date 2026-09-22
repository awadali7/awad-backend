import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService, currentCycle } from './bills.service';

type BillRow = {
  id: string;
  installmentsPaid: number | null;
  installmentsTotal: number | null;
  installmentsLeft: number | null;
  lastPaidCycle: string | null;
};

const bill = (overrides: Partial<BillRow> = {}): BillRow => ({
  id: 'bill-1',
  installmentsPaid: null,
  installmentsTotal: null,
  installmentsLeft: null,
  lastPaidCycle: null,
  ...overrides,
});

describe('BillsService', () => {
  let billsService: BillsService;
  const prisma = {
    bill: {
      findUnique: jest.fn(),
      update: jest.fn(),
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
      prisma.bill.findUnique.mockResolvedValue(
        bill({ installmentsPaid: 1, installmentsTotal: 12 }),
      );

      const result = await billsService.markPaid('bill-1', '2026-09');

      expect(result).toMatchObject({
        installmentsPaid: 2,
        lastPaidCycle: '2026-09',
      });
    });

    it('counts down a "N left" chit', async () => {
      prisma.bill.findUnique.mockResolvedValue(bill({ installmentsLeft: 2 }));

      const result = await billsService.markPaid('bill-1', '2026-09');

      expect(result).toMatchObject({
        installmentsLeft: 1,
        lastPaidCycle: '2026-09',
      });
    });

    it('only records the cycle for open-ended bills like rent', async () => {
      prisma.bill.findUnique.mockResolvedValue(bill());

      await billsService.markPaid('bill-1', '2026-09');

      expect(prisma.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { lastPaidCycle: '2026-09' },
      });
    });

    it('is idempotent — paying the same cycle twice does not double-count', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({
          installmentsPaid: 2,
          installmentsTotal: 12,
          lastPaidCycle: '2026-09',
        }),
      );

      const result = await billsService.markPaid('bill-1', '2026-09');

      expect(prisma.bill.update).not.toHaveBeenCalled();
      expect(result.installmentsPaid).toBe(2);
    });

    it('never counts past the total', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({ installmentsPaid: 12, installmentsTotal: 12 }),
      );

      const result = await billsService.markPaid('bill-1', '2026-09');

      expect(result.installmentsPaid).toBe(12);
    });

    it('never counts a chit below zero', async () => {
      prisma.bill.findUnique.mockResolvedValue(bill({ installmentsLeft: 0 }));

      const result = await billsService.markPaid('bill-1', '2026-09');

      expect(result.installmentsLeft).toBe(0);
    });

    it('defaults to the current cycle', async () => {
      prisma.bill.findUnique.mockResolvedValue(bill());

      const result = await billsService.markPaid('bill-1');

      expect(result.lastPaidCycle).toBe(currentCycle());
    });
  });

  describe('markUnpaid', () => {
    it('reverses a paid/total bill', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({
          installmentsPaid: 2,
          installmentsTotal: 12,
          lastPaidCycle: '2026-09',
        }),
      );

      const result = await billsService.markUnpaid('bill-1', '2026-09');

      expect(result).toMatchObject({
        installmentsPaid: 1,
        lastPaidCycle: null,
      });
    });

    it('reverses a "N left" chit', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({ installmentsLeft: 1, lastPaidCycle: '2026-09' }),
      );

      const result = await billsService.markUnpaid('bill-1', '2026-09');

      expect(result).toMatchObject({
        installmentsLeft: 2,
        lastPaidCycle: null,
      });
    });

    it('leaves a different cycle alone', async () => {
      prisma.bill.findUnique.mockResolvedValue(
        bill({
          installmentsPaid: 5,
          installmentsTotal: 12,
          lastPaidCycle: '2026-08',
        }),
      );

      await billsService.markUnpaid('bill-1', '2026-09');

      expect(prisma.bill.update).not.toHaveBeenCalled();
    });
  });
});
