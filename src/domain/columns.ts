import { DEFAULT_COLUMNS, LIMITS } from './constants';
import { COLUMN_KINDS } from './types';
import type { Column, ID, Issue } from './types';

export function defaultColumns(): Column[] {
  return DEFAULT_COLUMNS.map((c) => ({ ...c }));
}

/** Ids of the columns whose issues count as finished. */
export function doneIds(columns: Column[]): Set<ID> {
  return new Set(columns.filter((c) => c.kind === 'done').map((c) => c.id));
}

export function columnIndex(columns: Column[], id: ID): number {
  const i = columns.findIndex((c) => c.id === id);
  return i === -1 ? columns.length : i;
}

/** Older saved data has no columns, or issues that point at a column that was removed. */
export function normalizeColumns(raw: unknown): Column[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultColumns();
  const cols = raw.filter(
    (c): c is Column =>
      !!c && typeof c.id === 'string' && typeof c.name === 'string' && COLUMN_KINDS.includes(c.kind),
  );
  return cols.length ? cols : defaultColumns();
}

/** Returns an error message, or null when the list is fine. */
export function validateColumns(columns: Column[]): string | null {
  if (columns.length === 0) return 'A project needs at least one column.';
  if (columns.length > LIMITS.maxColumns) return `Use ${LIMITS.maxColumns} columns or fewer.`;
  const seen = new Set<string>();
  for (const c of columns) {
    const name = c.name.trim();
    if (!name) return 'Every column needs a name.';
    if (name.length > LIMITS.columnName) return `Keep column names under ${LIMITS.columnName} characters.`;
    if (!COLUMN_KINDS.includes(c.kind)) return 'Choose what each column is for.';
    const key = name.toLowerCase();
    if (seen.has(key)) return `Two columns are called "${name}". Give each its own name.`;
    seen.add(key);
  }
  return null;
}

/** Where an issue should land when its column is missing. */
export function firstColumnId(columns: Column[]): ID {
  return (columns.find((c) => c.kind === 'todo') ?? columns[0]).id;
}

export function issueCountByColumn(issues: Issue[]): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const i of issues) m.set(i.status, (m.get(i.status) ?? 0) + 1);
  return m;
}
