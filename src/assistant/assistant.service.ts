import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureOpenAiService } from './azure-openai.service';
import { InterpretDto } from './dto/interpret.dto';
import type { Proposal, ProposalKind } from './assistant.types';

const KINDS: ProposalKind[] = [
  'expense',
  'income',
  'emi',
  'borrowing',
  'clarify',
  'unknown',
];

/** "YYYY-MM" for the month being worked in. */
function currentCycle(now: Date = new Date()): string {
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azure: AzureOpenAiService,
  ) {}

  get isConfigured(): boolean {
    return this.azure.isConfigured;
  }

  async interpret(dto: InterpretDto): Promise<Proposal> {
    const cycle = dto.cycle ?? currentCycle();
    const categories = await this.prisma.category.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    const byKind = (kind: string) =>
      categories
        .filter((category) => category.kind === kind)
        .map((category) => category.name);

    const today = new Date().toISOString().slice(0, 10);
    const raw = await this.azure.complete([
      { role: 'system', content: this.systemPrompt(cycle, today, byKind) },
      {
        role: 'user',
        // A menu pick is a hint, not an instruction. If the message plainly
        // describes something else, the message wins — otherwise a wrong tap
        // traps the conversation in the wrong kind.
        content: dto.kind
          ? `The operator tapped "${dto.kind}" in the menu, which is only a hint. If this message clearly describes a different kind, use that instead. Message: ${dto.message}`
          : dto.message,
      },
    ]);

    return this.toProposal(raw, cycle);
  }

  private systemPrompt(
    cycle: string,
    today: string,
    byKind: (kind: string) => string[],
  ): string {
    return [
      'You turn short notes about household money into structured records.',
      'Reply ONLY with a JSON object. Amounts are whole rupees, never decimals.',
      `Today is ${today}. The month currently in view is ${cycle}.`,
      'Resolve "today", "yesterday" and "tomorrow" against that date.',
      '',
      'Pick one "kind":',
      '  expense   — money already spent (groceries, fuel, eating out)',
      '  income    — money received (salary, bonus, freelance)',
      '  emi       — a recurring monthly obligation (loan, chit, rent, card)',
      '  borrowing — a single sum borrowed from a person, owed back by a date',
      '  clarify   — you need more information before proposing anything',
      '  unknown   — the message is not about money',
      '',
      'Fields by kind:',
      `  expense:   { "label", "amount", "category", "cycle" }  category from: ${byKind('expense').join(', ') || '(none defined)'}`,
      `  income:    { "label", "amount", "cycle" }  cycle null means it repeats every month`,
      `  emi:       { "name", "category", "type", "amount", "dueDay" }  type is one of emi|chitty|recurring|credit_card; category from: ${byKind('emi').join(', ') || '(none defined)'}`,
      '  borrowing: { "lender", "amount", "startDate", "dueDate" }  dates as YYYY-MM-DD',
      '',
      'Rules:',
      '- If the operator corrects you ("not an emi, it is an expense"), believe the correction.',
      '- Never ask for a field that belongs to a different kind than the one the message describes.',
      '- Choose the closest existing category. If none fits, use your own short label.',
      '- Never invent an amount. If the message has no amount, use kind "clarify".',
      '- List any field you could not fill in "missing".',
      '- NOTHING IS SAVED YET. Your reply is asking permission, not reporting a result.',
      '- "reply" must be one short question inviting confirmation, e.g.',
      '    "Add 243 for vegetables under Groceries?"',
      '    "Record 25000 borrowed from Rahul, due 15 Jan 2027?"',
      '- Never use past tense such as "I have recorded" or "This is recorded".',
      '',
      'Shape: { "kind": ..., "reply": ..., "fields": {...} | null, "missing": [...] }',
    ].join('\n');
  }

  /**
   * Model output is untrusted input. Everything is re-checked here, and the
   * downstream create endpoints validate again — this only decides what to
   * show the operator for confirmation.
   */
  private toProposal(raw: string, cycle: string): Proposal {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {
        kind: 'unknown',
        reply: "Sorry, I couldn't read that. Try rephrasing it.",
        fields: null,
        missing: [],
      };
    }

    const kind = KINDS.includes(parsed.kind as ProposalKind)
      ? (parsed.kind as ProposalKind)
      : 'unknown';

    const reply =
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 300)
        : 'Does this look right?';

    const missing = Array.isArray(parsed.missing)
      ? parsed.missing
          .filter((m): m is string => typeof m === 'string')
          .slice(0, 8)
      : [];

    const fields =
      parsed.fields && typeof parsed.fields === 'object'
        ? this.sanitiseFields(
            kind,
            parsed.fields as Record<string, unknown>,
            cycle,
          )
        : null;

    // A record with no real amount is junk. The prompt asks the model to return
    // "clarify" instead, but it sometimes proposes 0 anyway — so enforce it here
    // rather than letting a zero-rupee row sit one tap from being saved.
    const RECORD_KINDS = ['expense', 'income', 'emi', 'borrowing'];
    const amount = fields?.amount;
    if (
      RECORD_KINDS.includes(kind) &&
      (typeof amount !== 'number' || amount <= 0)
    ) {
      return {
        kind: 'clarify',
        reply: 'How much was it?',
        fields: null,
        missing: ['amount'],
      };
    }

    return { kind, reply, fields, missing };
  }

  private sanitiseFields(
    kind: ProposalKind,
    fields: Record<string, unknown>,
    cycle: string,
  ): Record<string, unknown> | null {
    const text = (value: unknown, max = 80): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    };

    // Rupees only: a model returning 243.5 or "243" must not reach the DB.
    const rupees = (value: unknown): number | null => {
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
    };

    const monthCycle = (value: unknown): string | null =>
      typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
        ? value
        : null;

    const isoDate = (value: unknown): string | null =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value
        : null;

    switch (kind) {
      case 'expense':
        return {
          label: text(fields.label),
          amount: rupees(fields.amount),
          category: text(fields.category, 60),
          cycle: monthCycle(fields.cycle) ?? cycle,
        };
      case 'income':
        return {
          label: text(fields.label),
          amount: rupees(fields.amount),
          // null is meaningful here: it marks permanent income.
          cycle:
            fields.cycle === null ? null : (monthCycle(fields.cycle) ?? cycle),
        };
      case 'emi': {
        const types = ['emi', 'chitty', 'recurring', 'credit_card'];
        const dueDay = Number(fields.dueDay);
        return {
          name: text(fields.name),
          category: text(fields.category, 60),
          type: types.includes(fields.type as string) ? fields.type : 'emi',
          amount: rupees(fields.amount),
          dueDay:
            Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
              ? dueDay
              : null,
        };
      }
      case 'borrowing':
        return {
          lender: text(fields.lender),
          amount: rupees(fields.amount),
          startDate: isoDate(fields.startDate),
          dueDate: isoDate(fields.dueDate),
        };
      default:
        return null;
    }
  }
}
