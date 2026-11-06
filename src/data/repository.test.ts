import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageRepository } from './localStorageRepository';
import type { KeyValueStorage } from './localStorageRepository';
import { ValidationError } from '../domain/validation';
import type { IssueInput } from '../domain/types';

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('quota');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const KEY = 'test:key';
const issueInput: IssueInput = {
  title: '  New thing  ',
  description: 'Details',
  status: 'todo',
  priority: 'high',
  assigneeId: 'u_dev',
  labelIds: ['l_bug', 'l_does_not_exist'],
  dueDate: '2026-12-01',
};

let storage: FakeStorage;
let repo: LocalStorageRepository;
beforeEach(() => {
  storage = new FakeStorage();
  repo = new LocalStorageRepository({ storage, key: KEY, now: () => new Date(2026, 10, 5, 9, 30) });
});

describe('LocalStorageRepository', () => {
  it('seeds sample data on first load and persists it', async () => {
    const snap = await repo.load();
    expect(snap.projects.length).toBeGreaterThanOrEqual(3);
    expect(snap.issues.length).toBeGreaterThan(20);
    expect(storage.getItem(KEY)).toBeTruthy();
  });

  it('keeps changes across a "reload" (new repository over the same storage)', async () => {
    const { value } = await repo.createIssue('p_web', issueInput);
    const again = new LocalStorageRepository({ storage, key: KEY });
    const snap = await again.load();
    expect(snap.issues.find((i) => i.id === value.id)?.title).toBe('New thing');
  });

  it('creates issues with trimmed titles, per-project numbers, cleaned labels, and an activity event', async () => {
    const before = (await repo.load()).projects.find((p) => p.id === 'p_web')!.issueCounter;
    const r = await repo.createIssue('p_web', issueInput);
    expect(r.value.number).toBe(before + 1);
    expect(r.value.labelIds).toEqual(['l_bug']);
    expect(r.events[0].type).toBe('issue.created');
    expect(r.events[0].data.issueRef).toBe(`WEB-${before + 1}`);
  });

  it('never reuses an issue number after a delete', async () => {
    const a = await repo.createIssue('p_web', issueInput);
    await repo.deleteIssue(a.value.id);
    const b = await repo.createIssue('p_web', issueInput);
    expect(b.value.number).toBe(a.value.number + 1);
  });

  it('rejects invalid input with a ValidationError and writes nothing', async () => {
    await repo.load();
    const snapshotBefore = storage.getItem(KEY);
    await expect(repo.createIssue('p_web', { ...issueInput, title: ' ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.createIssue('p_web', { ...issueInput, dueDate: '2026-02-30' })).rejects.toBeInstanceOf(ValidationError);
    expect(storage.getItem(KEY)).toBe(snapshotBefore);
  });

  it('records status changes separately and skips no-op updates', async () => {
    const r = await repo.updateIssue('i_web_2', { status: 'done', priority: 'low' });
    expect(r.events.map((e) => e.type).sort()).toEqual(['issue.status_changed', 'issue.updated']);
    const noop = await repo.updateIssue('i_web_2', { status: 'done' });
    expect(noop.events).toHaveLength(0);
  });

  it('blocks edits to archived projects until restored', async () => {
    await repo.archiveProject('p_web');
    await expect(repo.createIssue('p_web', issueInput)).rejects.toThrow(/archived/);
    await expect(repo.moveIssue('i_web_2', 'done')).rejects.toThrow(/archived/);
    await repo.restoreProject('p_web');
    await expect(repo.moveIssue('i_web_2', 'done')).resolves.toBeTruthy();
  });

  it('generates unique project keys and removes issues with a deleted project', async () => {
    const a = await repo.createProject({ name: 'Website Redesign', description: '', color: '#1f4d3f' });
    const b = await repo.createProject({ name: 'Website Redesign', description: '', color: '#1f4d3f' });
    expect(a.value.key).not.toBe(b.value.key);
    await repo.deleteProject('p_mob');
    const snap = await repo.load();
    expect(snap.projects.some((p) => p.id === 'p_mob')).toBe(false);
    expect(snap.issues.some((i) => i.projectId === 'p_mob')).toBe(false);
  });

  it('reuses an existing label instead of duplicating it', async () => {
    const a = await repo.createLabel({ name: 'Bug', color: '#000000' });
    expect(a.id).toBe('l_bug');
  });

  it('surfaces a friendly error when storage is full, and keeps old data', async () => {
    await repo.load();
    storage.failWrites = true;
    await expect(repo.createIssue('p_web', issueInput)).rejects.toThrow(/Could not save/);
  });

  it('falls back to sample data on corrupt storage but keeps a backup copy', async () => {
    storage.setItem(KEY, '{not json');
    const snap = await repo.load();
    expect(snap.projects.length).toBeGreaterThan(0);
    expect(storage.getItem(`${KEY}:corrupt-backup`)).toBe('{not json');
  });

  it('restores sample data on request', async () => {
    await repo.deleteProject('p_web');
    const snap = await repo.resetToSample();
    expect(snap.projects.some((p) => p.id === 'p_web')).toBe(true);
  });

  it('gives new projects the five default columns', async () => {
    const r = await repo.createProject({ name: 'Brand new', description: '', color: '#1f4d3f' });
    expect(r.value.columns.map((c) => c.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'In Review', 'Done']);
  });

  it('upgrades older saved projects that have no columns', async () => {
    const snap = await repo.load();
    const old = JSON.parse(JSON.stringify(snap));
    for (const p of old.projects) delete p.columns;
    storage.setItem(KEY, JSON.stringify(old));
    const again = await new LocalStorageRepository({ storage, key: KEY }).load();
    expect(again.projects[0].columns).toHaveLength(5);
  });

  it('adds, renames and reorders columns, and accepts issues in a new column', async () => {
    const snap = await repo.load();
    const cols = snap.projects.find((p) => p.id === 'p_web')!.columns.map((c) => ({ ...c }));
    cols.splice(3, 0, { id: 'c_qa', name: 'QA', kind: 'in_review' });
    cols[0].name = 'Ideas';
    await repo.updateColumns('p_web', cols, {});
    const moved = await repo.moveIssue('i_web_2', 'c_qa');
    expect(moved.value.status).toBe('c_qa');
    expect(moved.events[0].data.to).toBe('QA');
    const after = (await repo.load()).projects.find((p) => p.id === 'p_web')!.columns;
    expect(after.map((c) => c.name)).toEqual(['Ideas', 'Todo', 'In Progress', 'QA', 'In Review', 'Done']);
  });

  it('requires a destination for issues when a column is removed, then moves them', async () => {
    const snap = await repo.load();
    const cols = snap.projects.find((p) => p.id === 'p_web')!.columns.filter((c) => c.id !== 'in_progress');
    const inProgress = snap.issues.filter((i) => i.projectId === 'p_web' && i.status === 'in_progress');
    expect(inProgress.length).toBeGreaterThan(0);
    await expect(repo.updateColumns('p_web', cols, {})).rejects.toThrow(/Choose where/);
    await repo.updateColumns('p_web', cols, { in_progress: 'todo' });
    const after = await repo.load();
    for (const i of inProgress) expect(after.issues.find((x) => x.id === i.id)!.status).toBe('todo');
  });

  it('rejects an issue status that is not one of the project columns, and invalid column lists', async () => {
    await expect(repo.createIssue('p_web', { ...issueInput, status: 'nope' })).rejects.toBeInstanceOf(ValidationError);
    const cols = (await repo.load()).projects[0].columns;
    await expect(repo.updateColumns('p_web', [], {})).rejects.toThrow(/at least one/);
    await expect(repo.updateColumns('p_web', [cols[0], { ...cols[1], name: cols[0].name }], {})).rejects.toThrow(/Two columns/);
  });
});
