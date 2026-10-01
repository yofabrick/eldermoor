import type { GameSave } from './types';

const KEY = 'eldermoor_save_v1';

export function saveGame(data: GameSave): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadGame(): GameSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameSave;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return Boolean(localStorage.getItem(KEY));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
