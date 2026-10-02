import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { currentCycle, IncomeService } from './income.service';

type SourceRow = {
  id: string;
  label: string;
  amount: number;
  cycle: string | null;
};

describe('IncomeService', () => {
  let incomeService: IncomeService;
  const prisma = {
    incomeSource: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [IncomeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    incomeService = moduleRef.get(IncomeService);
  });

  describe('findForCycle', () => {
    const rows: SourceRow[] = [
      { id: '1', label: 'My salary', amount: 30_000, cycle: null },
      { id: '2', label: 'Spouse salary', amount: 10_000, cycle: null },
      { id: '3', label: 'Diwali bonus', amount: 15_000, cycle: '2026-10' },
    ];

    it('adds one-offs on top of permanent income', async () => {
      prisma.incomeSource.findMany.mockResolvedValue(rows);

      const result = await incomeService.findForCycle('2026-10');

      expect(result.permanentTotal).toBe(40_000);
      expect(result.monthlyTotal).toBe(15_000);
      expect(result.total).toBe(55_000);
    });

    it('splits permanent from one-off', async () => {
      prisma.incomeSource.findMany.mockResolvedValue(rows);

      const result = await incomeService.findForCycle('2026-10');

      expect(result.permanent.map((s) => s.label)).toEqual([
        'My salary',
        'Spouse salary',
      ]);
      expect(result.monthly.map((s) => s.label)).toEqual(['Diwali bonus']);
    });

    it('only asks the database for permanent rows and the requested cycle', async () => {
      prisma.incomeSource.findMany.mockResolvedValue([]);

      await incomeService.findForCycle('2026-10');

      expect(prisma.incomeSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ cycle: null }, { cycle: '2026-10' }] },
        }),
      );
    });

    it('totals to just the permanent income when a month has no one-offs', async () => {
      prisma.incomeSource.findMany.mockResolvedValue(
        rows.filter((row) => row.cycle === null),
      );

      const result = await incomeService.findForCycle('2026-09');

      expect(result.monthly).toEqual([]);
      expect(result.total).toBe(40_000);
    });

    it('defaults to the current cycle', async () => {
      prisma.incomeSource.findMany.mockResolvedValue([]);

      const result = await incomeService.findForCycle();

      expect(result.cycle).toBe(currentCycle());
    });
  });

  describe('create', () => {
    it('stores a one-off against its cycle', async () => {
      prisma.incomeSource.create.mockImplementation(
        (args: { data: SourceRow }) => Promise.resolve(args.data),
      );

      await incomeService.create({
        label: '  Diwali bonus  ',
        amount: 15_000,
        cycle: '2026-10',
      });

      expect(prisma.incomeSource.create).toHaveBeenCalledWith({
        // Label trimmed so stray whitespace doesn't show up in the UI.
        data: { label: 'Diwali bonus', amount: 15_000, cycle: '2026-10' },
      });
    });

    it('stores permanent income with a null cycle', async () => {
      prisma.incomeSource.create.mockImplementation(
        (args: { data: SourceRow }) => Promise.resolve(args.data),
      );

      await incomeService.create({ label: 'My salary', amount: 30_000 });

      expect(prisma.incomeSource.create).toHaveBeenCalledWith({
        data: { label: 'My salary', amount: 30_000, cycle: null },
      });
    });
  });

  describe('remove', () => {
    it('rejects an unknown id', async () => {
      prisma.incomeSource.findUnique.mockResolvedValue(null);

      await expect(incomeService.remove('nope')).rejects.toThrow(/not found/);
      expect(prisma.incomeSource.delete).not.toHaveBeenCalled();
    });
  });
});
