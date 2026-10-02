import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantService } from './assistant.service';
import { AzureOpenAiService } from './azure-openai.service';

describe('AssistantService', () => {
  let assistantService: AssistantService;
  type ChatMessage = { role: string; content: string };
  const complete = jest.fn<Promise<string>, [ChatMessage[]]>();
  const azure = { complete, isConfigured: true };
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue([
        { kind: 'expense', name: 'Groceries' },
        { kind: 'expense', name: 'Fuel' },
        { kind: 'emi', name: 'Appliance EMI' },
      ]),
    },
  };

  const ask = (modelOutput: string, message = 'anything') => {
    complete.mockResolvedValue(modelOutput);
    return assistantService.interpret({ message, cycle: '2026-10' });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: PrismaService, useValue: prisma },
        { provide: AzureOpenAiService, useValue: azure },
      ],
    }).compile();
    assistantService = moduleRef.get(AssistantService);
  });

  it('turns a spending note into an expense proposal', async () => {
    const result = await ask(
      JSON.stringify({
        kind: 'expense',
        reply: 'Add ₹243 for vegetables under Groceries?',
        fields: {
          label: 'Vegetables',
          amount: 243,
          category: 'Groceries',
          cycle: '2026-10',
        },
        missing: [],
      }),
      'i buy vegtable for 243 rupees',
    );

    expect(result.kind).toBe('expense');
    expect(result.fields).toMatchObject({
      label: 'Vegetables',
      amount: 243,
      category: 'Groceries',
      cycle: '2026-10',
    });
  });

  it('offers the existing categories to the model', async () => {
    await ask(JSON.stringify({ kind: 'unknown', reply: 'hm', fields: null }));

    const systemPrompt = complete.mock.calls[0][0][0].content;
    expect(systemPrompt).toContain('Groceries');
    expect(systemPrompt).toContain('Fuel');
    expect(systemPrompt).toContain('2026-10');
  });

  describe('model output is untrusted', () => {
    it('rounds a fractional amount to whole rupees', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'expense',
          reply: 'ok',
          fields: { label: 'Milk', amount: 243.67, category: 'Groceries' },
          missing: [],
        }),
      );

      expect(result.fields?.amount).toBe(244);
    });

    it('rejects a negative amount outright rather than proposing it', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'expense',
          reply: 'ok',
          fields: { label: 'Milk', amount: -500, category: 'Groceries' },
          missing: [],
        }),
      );

      // Falls all the way back to asking, so nothing is one tap from saving.
      expect(result.kind).toBe('clarify');
      expect(result.fields).toBeNull();
    });

    it('falls back to the month in view when the model invents a bad cycle', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'expense',
          reply: 'ok',
          fields: { label: 'Milk', amount: 50, cycle: 'next month' },
          missing: [],
        }),
      );

      expect(result.fields?.cycle).toBe('2026-10');
    });

    it('keeps a null income cycle, which means permanent', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'income',
          reply: 'ok',
          fields: { label: 'Salary', amount: 30000, cycle: null },
          missing: [],
        }),
      );

      expect(result.fields?.cycle).toBeNull();
    });

    it('rejects an out-of-range due day', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'emi',
          reply: 'ok',
          fields: { name: 'Loan', amount: 1000, dueDay: 45, type: 'emi' },
          missing: [],
        }),
      );

      expect(result.fields?.dueDay).toBeNull();
    });

    it('falls back to a safe EMI type when the model invents one', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'emi',
          reply: 'ok',
          fields: { name: 'Loan', amount: 1000, dueDay: 5, type: 'mortgage' },
          missing: [],
        }),
      );

      expect(result.fields?.type).toBe('emi');
    });

    it('rejects a malformed borrowing date', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'borrowing',
          reply: 'ok',
          fields: {
            lender: 'Rahul',
            amount: 25000,
            startDate: 'yesterday',
            dueDate: '2027-01-15',
          },
          missing: [],
        }),
      );

      expect(result.fields?.startDate).toBeNull();
      expect(result.fields?.dueDate).toBe('2027-01-15');
    });

    it('will not propose a zero-amount record', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'expense',
          reply: 'Add 0 for unspecified expense?',
          fields: { label: 'unspecified', amount: 0, category: 'unknown' },
          missing: [],
        }),
      );

      expect(result.kind).toBe('clarify');
      expect(result.fields).toBeNull();
      expect(result.missing).toContain('amount');
    });

    it('will not propose a record whose amount was rejected', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'borrowing',
          reply: 'ok',
          fields: { lender: 'Rahul', amount: -5, startDate: '2026-10-02' },
          missing: [],
        }),
      );

      expect(result.kind).toBe('clarify');
    });

    it('survives output that is not JSON at all', async () => {
      const result = await ask('I think you should buy vegetables!');

      expect(result.kind).toBe('unknown');
      expect(result.fields).toBeNull();
    });

    it('rejects an unrecognised kind', async () => {
      const result = await ask(
        JSON.stringify({ kind: 'transfer', reply: 'ok', fields: {} }),
      );

      expect(result.kind).toBe('unknown');
    });

    it('caps an over-long reply', async () => {
      const result = await ask(
        JSON.stringify({
          kind: 'unknown',
          reply: 'x'.repeat(5000),
          fields: null,
        }),
      );

      expect(result.reply.length).toBeLessThanOrEqual(300);
    });
  });

  it('passes the chosen kind through when the operator picked from the menu', async () => {
    complete.mockResolvedValue(
      JSON.stringify({ kind: 'borrowing', reply: 'ok', fields: null }),
    );

    await assistantService.interpret({
      message: '25000 from Rahul',
      cycle: '2026-10',
      kind: 'borrowing',
    });

    const userMessage = complete.mock.calls[0][0][1].content;
    expect(userMessage).toContain('borrowing');
  });
});
