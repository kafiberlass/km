/**
 * Хранение записи об идущей прогулке. Разбор и правила — в core/walk/session.ts.
 */

import { parseActiveWalk, serializeActiveWalk, type ActiveWalk } from '@/core/walk/session';

import { getValue, removeValue, setValue } from './kv';

const KEY = 'active-walk';

export function saveActiveWalk(walk: ActiveWalk): void {
  setValue(KEY, serializeActiveWalk(walk));
}

export function loadActiveWalk(): ActiveWalk | null {
  return parseActiveWalk(getValue(KEY));
}

export function clearActiveWalk(): void {
  removeValue(KEY);
}
