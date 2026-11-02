export type Role = 'requester' | 'approver';

export type DemoUser = { email: string; password: string; role: Role; detail: string };

// Demo accounts. The passwords are published in the README so judges can try both roles.
export const DEMO_USERS: DemoUser[] = [
  { email: 'requester@demo', password: 'requester-demo', role: 'requester', detail: 'Runs the agent. Cannot approve.' },
  { email: 'approver@demo', password: 'approver-demo', role: 'approver', detail: 'Reviews escalated purchases.' },
];
