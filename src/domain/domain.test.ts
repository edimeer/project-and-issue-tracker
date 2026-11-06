import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { defaultColumns, doneIds, validateColumns } from './columns';
import { addDays, describeDue, diffDays, formatDate, isValidDateString } from './dates';
import { applyFilters, emptyFilters, groupIssues, sortIssues, upcomingDue } from './filters';
import type { LookupContext } from './filters';
import { hasErrors, validateIssue, validateProject } from './validation';
import type { IssueInput } from './types';

const NOW = new Date(2026, 10, 5, 12, 0, 0); // Nov 5, 2026 local time

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidDateString('2026-11-05')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('11/05/2026')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });

  it('adds and diffs days across month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-05', '2026-11-08')).toBe(3);
    expect(diffDays('2026-11-05', '2026-11-01')).toBe(-4);
  });

  it('formats and describes dates consistently', () => {
    expect(formatDate('2026-11-05')).toBe('Nov 5, 2026');
    expect(describeDue('2026-11-03', '2026-11-05')).toEqual({ text: 'Overdue by 2 days', tone: 'overdue' });
    expect(describeDue('2026-11-05', '2026-11-05').text).toBe('Due today');
    expect(describeDue('2026-11-06', '2026-11-05').text).toBe('Due tomorrow');
    expect(describeDue('2026-11-20', '2026-11-05').tone).toBe('normal');
  });
});

describe('validation', () => {
  const valid: IssueInput = {
    title: 'Fix it',
    description: '',
    status: 'todo',
    priority: 'low',
    assigneeId: null,
    labelIds: [],
    dueDate: null,
  };

  it('requires an issue title', () => {
    expect(validateIssue({ ...valid, title: '   ' }).title).toBeTruthy();
    expect(hasErrors(validateIssue(valid))).toBe(false);
  });

  it('rejects impossible due dates and over-long titles', () => {
    expect(validateIssue({ ...valid, dueDate: '2026-02-31' }).dueDate).toBeTruthy();
    expect(validateIssue({ ...valid, title: 'x'.repeat(200) }).title).toBeTruthy();
  });

  it('requires a project name and colour', () => {
    expect(validateProject({ name: '', description: '', color: '#123456' }).name).toBeTruthy();
    expect(validateProject({ name: 'A', description: '', color: 'red' }).color).toBeTruthy();
  });
});

describe('filters, sorting and grouping', () => {
  const snap = createSeed(NOW);
  const projectIssues = snap.issues.filter((i) => i.projectId === 'p_web');
  const ctx: LookupContext = {
    today: '2026-11-05',
    projectKey: 'WEB',
    columns: defaultColumns(),
    doneIds: doneIds(defaultColumns()),
    usersById: new Map(snap.users.map((u) => [u.id, u])),
    labelsById: new Map(snap.labels.map((l) => [l.id, l])),
  };

  it('returns everything with empty filters', () => {
    expect(applyFilters(projectIssues, emptyFilters, ctx)).toHaveLength(projectIssues.length);
  });

  it('searches by text, issue reference and person', () => {
    expect(applyFilters(projectIssues, { ...emptyFilters, query: 'contact form' }, ctx).map((i) => i.number)).toEqual([7]);
    expect(applyFilters(projectIssues, { ...emptyFilters, query: 'web-7' }, ctx)).toHaveLength(1);
    expect(applyFilters(projectIssues, { ...emptyFilters, query: 'sofia' }, ctx).every((i) => i.assigneeId === 'u_sofia')).toBe(true);
  });

  it('combines facets with AND and values within a facet with OR', () => {
    const r = applyFilters(projectIssues, { ...emptyFilters, statuses: ['todo', 'done'], priorities: ['high'] }, ctx);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => ['todo', 'done'].includes(i.status) && i.priority === 'high')).toBe(true);
  });

  it('filters unassigned and overdue issues', () => {
    const un = applyFilters(projectIssues, { ...emptyFilters, assignees: ['unassigned'] }, ctx);
    expect(un.every((i) => i.assigneeId === null)).toBe(true);
    const od = applyFilters(projectIssues, { ...emptyFilters, due: 'overdue' }, ctx);
    expect(od.every((i) => i.dueDate && i.dueDate < '2026-11-05' && i.status !== 'done')).toBe(true);
  });

  it('sorts by priority and keeps undated issues last when sorting by due date', () => {
    const byPriority = sortIssues(projectIssues, { field: 'priority', dir: 'desc' }, defaultColumns());
    expect(byPriority[0].priority).toBe('urgent');
    const byDue = sortIssues(projectIssues, { field: 'due', dir: 'asc' }, defaultColumns());
    const firstUndated = byDue.findIndex((i) => !i.dueDate);
    expect(byDue.slice(firstUndated).every((i) => !i.dueDate)).toBe(true);
  });

  it('groups by status in board order and drops empty groups', () => {
    const groups = groupIssues(sortIssues(projectIssues, { field: 'number', dir: 'asc' }, defaultColumns()), 'status', ctx);
    expect(groups.map((g) => g.key)).toEqual(['backlog', 'todo', 'in_progress', 'in_review', 'done']);
    expect(groups.reduce((n, g) => n + g.issues.length, 0)).toBe(projectIssues.length);
    const onlyDone = groupIssues(projectIssues.filter((i) => i.status === 'done'), 'status', ctx);
    expect(onlyDone).toHaveLength(1);
  });

  it('lists upcoming due issues, excluding done work', () => {
    const up = upcomingDue(projectIssues, '2026-11-05', 14, ctx.doneIds);
    expect(up.every((i) => i.status !== 'done')).toBe(true);
    expect(up.map((i) => i.dueDate)).toEqual([...up.map((i) => i.dueDate)].sort());
  });
});

describe('columns', () => {
  it('starts every project with the five default columns', () => {
    expect(defaultColumns().map((c) => c.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'In Review', 'Done']);
    expect([...doneIds(defaultColumns())]).toEqual(['done']);
  });

  it('rejects empty, duplicate, and too many columns', () => {
    const base = defaultColumns();
    expect(validateColumns([])).toBeTruthy();
    expect(validateColumns([{ ...base[0], name: '  ' }])).toBeTruthy();
    expect(validateColumns([base[0], { ...base[1], name: 'backlog' }])).toMatch(/Two columns/);
    expect(validateColumns(Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, kind: 'todo' as const })))).toBeTruthy();
    expect(validateColumns(base)).toBeNull();
  });

  it('groups by a project with custom columns, in board order', () => {
    const custom = [
      { id: 'ideas', name: 'Ideas', kind: 'backlog' as const },
      { id: 'shipped', name: 'Shipped', kind: 'done' as const },
    ];
    const snap = createSeed(NOW);
    const cctx: LookupContext = {
      today: '2026-11-05',
      projectKey: 'WEB',
      columns: custom,
      doneIds: doneIds(custom),
      usersById: new Map(snap.users.map((u) => [u.id, u])),
      labelsById: new Map(snap.labels.map((l) => [l.id, l])),
    };
    const issues = snap.issues.filter((i) => i.projectId === 'p_web').map((i, n) => ({ ...i, status: n % 2 ? 'shipped' : 'ideas' }));
    const groups = groupIssues(issues, 'status', cctx);
    expect(groups.map((g) => g.label)).toEqual(['Ideas', 'Shipped']);
  });
});
