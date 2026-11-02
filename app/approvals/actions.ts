'use server';

import { revalidatePath } from 'next/cache';
import { InvalidProposalError, runAgentTurn } from '@/lib/agent/propose';
import { getDb } from '@/lib/db';
import { approveAndExecute, executeDecision, rejectDecision } from '@/lib/executor';
import { DEMO_AGENT_ID } from '@/lib/policy/demo';
import type { AuditEntry } from '@/lib/types';
import { requireRole, requireSession } from '@/lib/auth/server';


const MAX_GOAL_LENGTH = 200;
const RUN_WINDOW_MS = 60_000;
const MAX_RUNS_PER_WINDOW = 10;

export type AgentRun =
  | { ok: true; entry: AuditEntry; paymentError?: string }
  | { ok: false; error: string }
  | null;

// The demo has no login, so cap how often anyone can call the model.
let recentRuns: number[] = [];

function refresh() {
  revalidatePath('/approvals');
  revalidatePath('/history');
  revalidatePath('/spend');
}

export async function decide(id: string, approve: boolean, _previous: string | null): Promise<string | null> {
  try {
    const { email } = await requireRole('approver');
    if (approve) await approveAndExecute(getDb(), id, email);
    else rejectDecision(getDb(), id, email);
    return null;
  } catch (err) {
    return (err as Error).message;
  } finally {
    refresh();
  }
}

export async function retryPayment(id: string, _previous: string | null): Promise<string | null> {
  try {
    await requireRole('approver');
    await executeDecision(getDb(), id);
    return null;
  } catch (err) {
    return (err as Error).message;
  } finally {
    refresh();
  }
}

export async function runGoal(_previous: AgentRun, form: FormData): Promise<AgentRun> {
  const session = await requireSession().catch(() => null);
  if (!session) return { ok: false, error: 'Your session has ended. Sign in again.' };
  const goal = String(form.get('goal') ?? '').trim();
  if (!goal) return { ok: false, error: 'Type a goal for the agent.' };
  if (goal.length > MAX_GOAL_LENGTH) return { ok: false, error: `Keep the goal under ${MAX_GOAL_LENGTH} characters.` };

  const now = Date.now();
  recentRuns = recentRuns.filter((at) => now - at < RUN_WINDOW_MS);
  if (recentRuns.length >= MAX_RUNS_PER_WINDOW) {
    return { ok: false, error: 'The demo agent is busy. Try again in a minute.' };
  }
  recentRuns.push(now);

  try {
    const db = getDb();
    const entry = await runAgentTurn(db, goal, { agentId: DEMO_AGENT_ID, requestedBy: session.email });
    if (entry.verdict.decision !== 'ALLOW') return { ok: true, entry };
    try {
      return { ok: true, entry: await executeDecision(db, entry.id) };
    } catch (err) {
      return { ok: true, entry, paymentError: (err as Error).message };
    }
  } catch (err) {
        const message = (err as Error).message;
    if (err instanceof InvalidProposalError) return { ok: false, error: `Rejected before policy: ${message}` };
    return { ok: false, error: 'The agent could not be reached. No purchase was made. Try again in a moment.' };
  } finally {
    refresh();
  }
}
