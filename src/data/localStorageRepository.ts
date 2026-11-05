import { PROJECT_COLORS } from '../domain/constants';
import { STATUS_META } from '../domain/constants';
import { issueRef } from '../domain/filters';
import { ValidationError, hasErrors, validateIssue, validateLabel, validateProject } from '../domain/validation';
import type {
  ActivityEvent,
  ActivityType,
  ID,
  Issue,
  IssueInput,
  Label,
  LabelInput,
  Project,
  ProjectInput,
  Snapshot,
  Status,
} from '../domain/types';
import { newId } from './ids';
import { RepositoryError } from './repository';
import type { Mutation, Repository } from './repository';
import { SNAPSHOT_VERSION, createSeed } from './seed';

/** The slice of the Web Storage API we use. Lets tests pass in a fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageRepositoryOptions {
  storage: KeyValueStorage;
  /** Storage key. Include the deploy base path: GitHub Pages user sites share one origin across repos. */
  key: string;
  now?: () => Date;
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === SNAPSHOT_VERSION &&
    typeof v.currentUserId === 'string' &&
    ['users', 'labels', 'projects', 'issues', 'activity'].every((k) => Array.isArray(v[k]))
  );
}

const MAX_ACTIVITY = 500;

function deriveKey(name: string, taken: Set<string>): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let base = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] ?? 'PRJ').slice(0, 3);
  if (base.length < 2) base = (words.join('') + 'PRJ').slice(0, 3);
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
  return key;
}

export class LocalStorageRepository implements Repository {
  private readonly storage: KeyValueStorage;
  private readonly key: string;
  private readonly now: () => Date;

  constructor(options: LocalStorageRepositoryOptions) {
    this.storage = options.storage;
    this.key = options.key;
    this.now = options.now ?? (() => new Date());
  }

  // ---- persistence ----

  private read(): Snapshot {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      throw new RepositoryError('Browser storage is not available, so changes cannot be saved.');
    }
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isSnapshot(parsed)) return parsed;
      } catch {
        /* fall through to the backup path */
      }
      // Unreadable data: keep a copy for recovery instead of silently destroying it.
      try {
        this.storage.setItem(`${this.key}:corrupt-backup`, raw);
      } catch {
        /* ignore */
      }
    }
    const fresh = createSeed(this.now());
    this.write(fresh);
    return fresh;
  }

  private write(snapshot: Snapshot): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(snapshot));
    } catch {
      throw new RepositoryError('Could not save your changes. Browser storage may be full or disabled.');
    }
  }

  private event(
    snap: Snapshot,
    type: ActivityType,
    projectId: ID,
    issueId: ID | null,
    data: ActivityEvent['data'],
  ): ActivityEvent {
    const e: ActivityEvent = {
      id: newId('e'),
      projectId,
      issueId,
      actorId: snap.currentUserId,
      type,
      data,
      createdAt: this.now().toISOString(),
    };
    snap.activity.unshift(e);
    if (snap.activity.length > MAX_ACTIVITY) snap.activity.length = MAX_ACTIVITY;
    return e;
  }

  private project(snap: Snapshot, id: ID): Project {
    const p = snap.projects.find((x) => x.id === id);
    if (!p) throw new RepositoryError('That project no longer exists.');
    return p;
  }

  private issue(snap: Snapshot, id: ID): { issue: Issue; project: Project } {
    const issue = snap.issues.find((x) => x.id === id);
    if (!issue) throw new RepositoryError('That issue no longer exists.');
    return { issue, project: this.project(snap, issue.projectId) };
  }

  private assertEditable(project: Project): void {
    if (project.archivedAt) throw new RepositoryError('This project is archived. Restore it to make changes.');
  }

  private cleanIssueInput(snap: Snapshot, input: IssueInput): IssueInput {
    const errors = validateIssue(input);
    if (hasErrors(errors)) throw new ValidationError(errors);
    const labelIds = input.labelIds.filter((id) => snap.labels.some((l) => l.id === id));
    const assigneeId = input.assigneeId && snap.users.some((u) => u.id === input.assigneeId) ? input.assigneeId : null;
    return { ...input, title: input.title.trim(), description: input.description.trim(), labelIds, assigneeId };
  }

  // ---- reads ----

  async load(): Promise<Snapshot> {
    return this.read();
  }

  subscribe(listener: () => void): () => void {
    const handler = (e: Event) => {
      if ((e as StorageEvent).key === this.key) listener();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // ---- projects ----

  async createProject(input: ProjectInput): Promise<Mutation<Project>> {
    const errors = validateProject(input);
    if (hasErrors(errors)) throw new ValidationError(errors);
    const snap = this.read();
    const stamp = this.now().toISOString();
    const project: Project = {
      id: newId('p'),
      key: deriveKey(input.name, new Set(snap.projects.map((p) => p.key))),
      name: input.name.trim(),
      description: input.description.trim(),
      color: input.color || PROJECT_COLORS[0],
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      issueCounter: 0,
    };
    snap.projects.push(project);
    const e = this.event(snap, 'project.created', project.id, null, { projectName: project.name });
    this.write(snap);
    return { value: project, events: [e] };
  }

  async updateProject(id: ID, patch: Partial<ProjectInput>): Promise<Mutation<Project>> {
    const snap = this.read();
    const project = this.project(snap, id);
    this.assertEditable(project);
    const next: ProjectInput = {
      name: patch.name ?? project.name,
      description: patch.description ?? project.description,
      color: patch.color ?? project.color,
    };
    const errors = validateProject(next);
    if (hasErrors(errors)) throw new ValidationError(errors);
    const events: ActivityEvent[] = [];
    const fields: string[] = [];
    if (next.name.trim() !== project.name) fields.push('name');
    if (next.description.trim() !== project.description) fields.push('description');
    if (next.color !== project.color) fields.push('colour');
    if (fields.length) {
      const oldName = project.name;
      project.name = next.name.trim();
      project.description = next.description.trim();
      project.color = next.color;
      project.updatedAt = this.now().toISOString();
      events.push(
        this.event(snap, 'project.updated', id, null, {
          projectName: project.name,
          from: fields.includes('name') ? oldName : undefined,
          fields,
        }),
      );
      this.write(snap);
    }
    return { value: project, events };
  }

  async archiveProject(id: ID): Promise<Mutation<Project>> {
    const snap = this.read();
    const project = this.project(snap, id);
    if (!project.archivedAt) {
      project.archivedAt = this.now().toISOString();
      project.updatedAt = project.archivedAt;
      const e = this.event(snap, 'project.archived', id, null, { projectName: project.name });
      this.write(snap);
      return { value: project, events: [e] };
    }
    return { value: project, events: [] };
  }

  async restoreProject(id: ID): Promise<Mutation<Project>> {
    const snap = this.read();
    const project = this.project(snap, id);
    if (project.archivedAt) {
      project.archivedAt = null;
      project.updatedAt = this.now().toISOString();
      const e = this.event(snap, 'project.restored', id, null, { projectName: project.name });
      this.write(snap);
      return { value: project, events: [e] };
    }
    return { value: project, events: [] };
  }

  async deleteProject(id: ID): Promise<void> {
    const snap = this.read();
    this.project(snap, id);
    snap.projects = snap.projects.filter((p) => p.id !== id);
    snap.issues = snap.issues.filter((i) => i.projectId !== id);
    snap.activity = snap.activity.filter((a) => a.projectId !== id);
    this.write(snap);
  }

  // ---- issues ----

  async createIssue(projectId: ID, input: IssueInput): Promise<Mutation<Issue>> {
    const snap = this.read();
    const project = this.project(snap, projectId);
    this.assertEditable(project);
    const clean = this.cleanIssueInput(snap, input);
    const stamp = this.now().toISOString();
    project.issueCounter += 1;
    const issue: Issue = {
      id: newId('i'),
      projectId,
      number: project.issueCounter,
      ...clean,
      createdAt: stamp,
      updatedAt: stamp,
    };
    snap.issues.push(issue);
    const e = this.event(snap, 'issue.created', projectId, issue.id, {
      issueRef: issueRef(project, issue),
      issueTitle: issue.title,
    });
    this.write(snap);
    return { value: issue, events: [e] };
  }

  async updateIssue(id: ID, patch: Partial<IssueInput>): Promise<Mutation<Issue>> {
    const snap = this.read();
    const { issue, project } = this.issue(snap, id);
    this.assertEditable(project);
    const merged: IssueInput = {
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      labelIds: issue.labelIds,
      dueDate: issue.dueDate,
      ...patch,
    };
    const clean = this.cleanIssueInput(snap, merged);

    const changed: string[] = [];
    if (clean.title !== issue.title) changed.push('title');
    if (clean.description !== issue.description) changed.push('description');
    if (clean.priority !== issue.priority) changed.push('priority');
    if (clean.assigneeId !== issue.assigneeId) changed.push('assignee');
    if (clean.dueDate !== issue.dueDate) changed.push('due date');
    if ([...clean.labelIds].sort().join() !== [...issue.labelIds].sort().join()) changed.push('labels');
    const statusChanged = clean.status !== issue.status;
    if (!changed.length && !statusChanged) return { value: issue, events: [] };

    const fromStatus = issue.status;
    Object.assign(issue, clean, { updatedAt: this.now().toISOString() });
    const events: ActivityEvent[] = [];
    const ref = issueRef(project, issue);
    if (statusChanged) {
      events.push(
        this.event(snap, 'issue.status_changed', project.id, id, {
          issueRef: ref,
          issueTitle: issue.title,
          from: STATUS_META[fromStatus].label,
          to: STATUS_META[issue.status].label,
        }),
      );
    }
    if (changed.length) {
      events.push(
        this.event(snap, 'issue.updated', project.id, id, { issueRef: ref, issueTitle: issue.title, fields: changed }),
      );
    }
    this.write(snap);
    return { value: issue, events };
  }

  async moveIssue(id: ID, status: Status): Promise<Mutation<Issue>> {
    return this.updateIssue(id, { status });
  }

  async deleteIssue(id: ID): Promise<Mutation<{ id: ID }>> {
    const snap = this.read();
    const { issue, project } = this.issue(snap, id);
    this.assertEditable(project);
    snap.issues = snap.issues.filter((i) => i.id !== id);
    const e = this.event(snap, 'issue.deleted', project.id, id, {
      issueRef: issueRef(project, issue),
      issueTitle: issue.title,
    });
    this.write(snap);
    return { value: { id }, events: [e] };
  }

  // ---- labels ----

  async createLabel(input: LabelInput): Promise<Label> {
    const errors = validateLabel(input);
    if (hasErrors(errors)) throw new ValidationError(errors);
    const snap = this.read();
    const name = input.name.trim();
    const existing = snap.labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const label: Label = { id: newId('l'), name, color: input.color };
    snap.labels.push(label);
    this.write(snap);
    return label;
  }

  // ---- maintenance ----

  async resetToSample(): Promise<Snapshot> {
    const fresh = createSeed(this.now());
    this.write(fresh);
    return fresh;
  }
}
