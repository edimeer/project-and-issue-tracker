import { PRIORITY_META } from './constants';
import { columnIndex } from './columns';
import { addDays, diffDays } from './dates';
import type { Column, ID, Issue, Label, Priority, Project, Status, User } from './types';

export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
export const UNASSIGNED = 'unassigned';

export interface IssueFilters {
  query: string;
  statuses: Status[];
  priorities: Priority[];
  /** User ids, or UNASSIGNED. */
  assignees: string[];
  labels: string[];
  due: DueFilter;
}

export const emptyFilters: IssueFilters = {
  query: '',
  statuses: [],
  priorities: [],
  assignees: [],
  labels: [],
  due: 'any',
};

export function countActiveFilters(f: IssueFilters): number {
  return (
    (f.query.trim() ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.priorities.length ? 1 : 0) +
    (f.assignees.length ? 1 : 0) +
    (f.labels.length ? 1 : 0) +
    (f.due !== 'any' ? 1 : 0)
  );
}

export interface LookupContext {
  today: string;
  projectKey: string;
  /** The project's columns, in board order. */
  columns: Column[];
  /** Ids of columns that count as finished. */
  doneIds: Set<ID>;
  usersById: Map<string, User>;
  labelsById: Map<string, Label>;
}

export function issueRef(project: Pick<Project, 'key'>, issue: Pick<Issue, 'number'>): string {
  return `${project.key}-${issue.number}`;
}

export function matchesFilters(issue: Issue, f: IssueFilters, ctx: LookupContext): boolean {
  if (f.statuses.length && !f.statuses.includes(issue.status)) return false;
  if (f.priorities.length && !f.priorities.includes(issue.priority)) return false;
  if (f.assignees.length) {
    const key = issue.assigneeId ?? UNASSIGNED;
    if (!f.assignees.includes(key)) return false;
  }
  if (f.labels.length && !f.labels.some((id) => issue.labelIds.includes(id))) return false;

  if (f.due !== 'any') {
    const due = issue.dueDate;
    if (f.due === 'none') {
      if (due) return false;
    } else {
      if (!due) return false;
      const delta = diffDays(ctx.today, due);
      if (f.due === 'overdue' && !(delta < 0 && !ctx.doneIds.has(issue.status))) return false;
      if (f.due === 'today' && delta !== 0) return false;
      if (f.due === 'week' && !(delta >= 0 && delta <= 7)) return false;
    }
  }

  const q = f.query.trim().toLowerCase();
  if (q) {
    const haystack = [
      `${ctx.projectKey}-${issue.number}`,
      issue.title,
      issue.description,
      issue.assigneeId ? (ctx.usersById.get(issue.assigneeId)?.name ?? '') : '',
      ...issue.labelIds.map((id) => ctx.labelsById.get(id)?.name ?? ''),
    ]
      .join('\n')
      .toLowerCase();
    // Every word must match somewhere, so "login urgent-ish" style queries narrow down.
    if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  return true;
}

export function applyFilters(issues: Issue[], f: IssueFilters, ctx: LookupContext): Issue[] {
  return issues.filter((i) => matchesFilters(i, f, ctx));
}

export type SortField = 'updated' | 'created' | 'priority' | 'status' | 'due' | 'title' | 'number';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  field: SortField;
  dir: SortDir;
}

export const SORT_LABELS: Record<SortField, string> = {
  updated: 'Last updated',
  created: 'Created',
  priority: 'Priority',
  status: 'Status',
  due: 'Due date',
  title: 'Title',
  number: 'Issue number',
};

function compareBy(field: SortField, a: Issue, b: Issue, columns: Column[]): number {
  switch (field) {
    case 'updated':
      return a.updatedAt.localeCompare(b.updatedAt);
    case 'created':
      return a.createdAt.localeCompare(b.createdAt);
    case 'priority':
      return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    case 'status':
      return columnIndex(columns, a.status) - columnIndex(columns, b.status);
    case 'title':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'number':
      return a.number - b.number;
    case 'due':
      // handled in sortIssues so empty dates always sort last
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  }
}

export function sortIssues(issues: Issue[], sort: SortState, columns: Column[]): Issue[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...issues].sort((a, b) => {
    if (sort.field === 'due') {
      if (!a.dueDate && !b.dueDate) return b.number - a.number;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
    }
    const primary = compareBy(sort.field, a, b, columns) * sign;
    if (primary !== 0) return primary;
    return b.number - a.number;
  });
}

export type GroupBy = 'none' | 'status' | 'priority' | 'assignee' | 'due';
export const GROUP_LABELS: Record<GroupBy, string> = {
  none: 'No grouping',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  due: 'Due date',
};

export interface IssueGroup {
  key: string;
  label: string;
  issues: Issue[];
}

const DUE_BUCKETS = [
  ['overdue', 'Overdue'],
  ['today', 'Due today'],
  ['week', 'Next 7 days'],
  ['later', 'Later'],
  ['none', 'No due date'],
] as const;

function dueBucket(issue: Issue, today: string, doneIds: Set<ID>): string {
  if (!issue.dueDate) return 'none';
  const delta = diffDays(today, issue.dueDate);
  if (delta < 0 && !doneIds.has(issue.status)) return 'overdue';
  if (delta === 0) return 'today';
  if (delta > 0 && delta <= 7) return 'week';
  return 'later';
}

/** Splits already-sorted issues into ordered groups. Empty groups are dropped. Order inside a group is preserved. */
export function groupIssues(issues: Issue[], by: GroupBy, ctx: LookupContext): IssueGroup[] {
  if (by === 'none') return [{ key: 'all', label: 'All issues', issues }];

  const defs: { key: string; label: string; test: (i: Issue) => boolean }[] = [];
  if (by === 'status') {
    for (const c of ctx.columns) defs.push({ key: c.id, label: c.name, test: (i) => i.status === c.id });
    // Issues whose column was removed elsewhere still show up rather than vanishing.
    const known = new Set(ctx.columns.map((c) => c.id));
    defs.push({ key: '__unknown', label: 'Other', test: (i) => !known.has(i.status) });
  } else if (by === 'priority') {
    for (const p of ['urgent', 'high', 'medium', 'low'] as const) {
      defs.push({ key: p, label: PRIORITY_META[p].label, test: (i) => i.priority === p });
    }
  } else if (by === 'due') {
    for (const [key, label] of DUE_BUCKETS) defs.push({ key, label, test: (i) => dueBucket(i, ctx.today, ctx.doneIds) === key });
  } else {
    const users = [...ctx.usersById.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const u of users) defs.push({ key: u.id, label: u.name, test: (i) => i.assigneeId === u.id });
    defs.push({ key: UNASSIGNED, label: 'Unassigned', test: (i) => i.assigneeId === null });
  }
  return defs
    .map((d) => ({ key: d.key, label: d.label, issues: issues.filter(d.test) }))
    .filter((g) => g.issues.length > 0);
}

export function isOverdue(issue: Pick<Issue, 'dueDate' | 'status'>, today: string, doneIds: Set<ID>): boolean {
  return !!issue.dueDate && !doneIds.has(issue.status) && issue.dueDate < today;
}

/** Open issues due within `days` days (inclusive), earliest first. */
export function upcomingDue(issues: Issue[], today: string, days: number, doneIds: Set<ID>): Issue[] {
  const end = addDays(today, days);
  return issues
    .filter((i) => !doneIds.has(i.status) && i.dueDate && i.dueDate >= today && i.dueDate <= end)
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
}
