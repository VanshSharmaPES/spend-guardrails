'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { approveAndExecute, executeDecision, rejectDecision } from '@/lib/executor';

const DEMO_USER = 'demo-user';

function refresh() {
  revalidatePath('/approvals');
  revalidatePath('/history');
  revalidatePath('/spend');
}

export async function decide(id: string, approve: boolean, _previous: string | null): Promise<string | null> {
  try {
    if (approve) await approveAndExecute(getDb(), id, DEMO_USER);
    else rejectDecision(getDb(), id, DEMO_USER);
    return null;
  } catch (err) {
    return (err as Error).message;
  } finally {
    refresh();
  }
}

export async function retryPayment(id: string, _previous: string | null): Promise<string | null> {
  try {
    await executeDecision(getDb(), id);
    return null;
  } catch (err) {
    return (err as Error).message;
  } finally {
    refresh();
  }
}
