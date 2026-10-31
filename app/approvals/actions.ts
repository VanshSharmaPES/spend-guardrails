'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { approveAndExecute, rejectDecision } from '@/lib/executor';

const DEMO_USER = 'demo-user';

export async function decide(id: string, approve: boolean, _previous: string | null): Promise<string | null> {
  try {
    if (approve) await approveAndExecute(getDb(), id, DEMO_USER);
    else rejectDecision(getDb(), id, DEMO_USER);
    revalidatePath('/approvals');
    revalidatePath('/history');
    return null;
  } catch (err) {
    revalidatePath('/approvals');
    return (err as Error).message;
  }
}
