import type Database from 'better-sqlite3';
import { demoPolicy } from '../policy/demo';
import { ensurePolicy } from './queries';
import { openDatabase } from './schema';

// Cached on globalThis so Next.js dev reloads reuse one connection instead of opening a new one each time.
const cache = globalThis as unknown as { guardrailsDb?: Database.Database };

export function getDb(): Database.Database {
  if (!cache.guardrailsDb) {
    const db = openDatabase();
    ensurePolicy(db, demoPolicy, new Date().toISOString());
    cache.guardrailsDb = db;
  }
  return cache.guardrailsDb;
}
