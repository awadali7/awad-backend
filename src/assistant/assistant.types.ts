/** What the assistant decided the message was about. */
export type ProposalKind =
  'expense' | 'income' | 'emi' | 'borrowing' | 'clarify' | 'unknown';

/**
 * A *proposed* record, never a written one.
 *
 * The assistant only ever suggests; the console shows the proposal and the
 * operator confirms it, which then goes through the normal validated endpoint.
 * A model that misreads "243" as "2430" must not be able to silently change
 * what someone owes.
 */
export type Proposal = {
  kind: ProposalKind;
  /** Shown to the operator — a confirmation summary or a follow-up question. */
  reply: string;
  /** Fields understood so far, shaped for the matching create endpoint. */
  fields: Record<string, unknown> | null;
  /** Fields still needed before this can be submitted. */
  missing: string[];
};
