import type { Column, ColumnKind, Priority } from './types';

/** Plain-language names for what a column does. Shown when choosing a column's behaviour. */
export const KIND_META: Record<ColumnKind, { label: string; hint: string }> = {
  backlog: { label: 'Waiting', hint: 'Ideas and work that is not planned yet' },
  todo: { label: 'Ready', hint: 'Planned and ready to pick up' },
  in_progress: { label: 'Working', hint: 'Someone is on it' },
  in_review: { label: 'Checking', hint: 'Waiting for a review or sign-off' },
  done: { label: 'Finished', hint: 'Complete. Issues here stop counting as overdue' },
};

/** The columns every new project starts with. Ids match the kinds so older saved data stays valid. */
export const DEFAULT_COLUMNS: Column[] = [
  { id: 'backlog', name: 'Backlog', kind: 'backlog' },
  { id: 'todo', name: 'Todo', kind: 'todo' },
  { id: 'in_progress', name: 'In Progress', kind: 'in_progress' },
  { id: 'in_review', name: 'In Review', kind: 'in_review' },
  { id: 'done', name: 'Done', kind: 'done' },
];

export const PRIORITY_META: Record<Priority, { label: string; rank: number }> = {
  low: { label: 'Low', rank: 1 },
  medium: { label: 'Medium', rank: 2 },
  high: { label: 'High', rank: 3 },
  urgent: { label: 'Urgent', rank: 4 },
};

export const PROJECT_COLORS = [
  '#1f4d3f',
  '#c2512d',
  '#2f5fa7',
  '#7a4a9e',
  '#b07a12',
  '#a63a55',
  '#3b7f86',
  '#5b6b2c',
];

export const LABEL_COLORS = ['#2f7d5b', '#c2512d', '#2f5fa7', '#7a4a9e', '#b07a12', '#a63a55', '#3b7f86', '#6b6f76'];

export const LIMITS = {
  projectName: 60,
  projectDescription: 280,
  issueTitle: 140,
  issueDescription: 5000,
  labelName: 24,
  columnName: 24,
  maxColumns: 12,
} as const;
