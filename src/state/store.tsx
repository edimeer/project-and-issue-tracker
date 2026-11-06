import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Repository } from '../data/repository';
import { ValidationError } from '../domain/validation';
import type {
  ActivityEvent,
  Column,
  ID,
  Issue,
  IssueInput,
  Label,
  LabelInput,
  Project,
  ProjectInput,
  Snapshot,
  Status,
  User,
} from '../domain/types';
import { useToast } from '../components/ui/Toasts';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: Snapshot };

type Action =
  | { type: 'loaded'; data: Snapshot }
  | { type: 'failed'; message: string }
  | { type: 'project'; project: Project; events: ActivityEvent[] }
  | { type: 'project-removed'; id: ID }
  | { type: 'columns'; project: Project; moves: Record<ID, ID>; events: ActivityEvent[] }
  | { type: 'issue'; issue: Issue; events: ActivityEvent[] }
  | { type: 'issue-removed'; id: ID; events: ActivityEvent[] }
  | { type: 'label'; label: Label };

function upsert<T extends { id: ID }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { phase: 'ready', data: action.data };
  if (action.type === 'failed') return { phase: 'error', message: action.message };
  if (state.phase !== 'ready') return state;
  const d = state.data;
  switch (action.type) {
    case 'project':
      return { phase: 'ready', data: { ...d, projects: upsert(d.projects, action.project), activity: [...action.events, ...d.activity] } };
    case 'columns': {
      const now = new Date().toISOString();
      const issues = d.issues.map((i) =>
        i.projectId === action.project.id && action.moves[i.status] ? { ...i, status: action.moves[i.status], updatedAt: now } : i,
      );
      return { phase: 'ready', data: { ...d, projects: upsert(d.projects, action.project), issues, activity: [...action.events, ...d.activity] } };
    }
    case 'project-removed':
      return {
        phase: 'ready',
        data: {
          ...d,
          projects: d.projects.filter((p) => p.id !== action.id),
          issues: d.issues.filter((i) => i.projectId !== action.id),
          activity: d.activity.filter((a) => a.projectId !== action.id),
        },
      };
    case 'issue': {
      // Creating an issue also bumps the project's counter, which the repository did already; keep ours in step.
      const projects = d.projects.map((p) =>
        p.id === action.issue.projectId && p.issueCounter < action.issue.number ? { ...p, issueCounter: action.issue.number } : p,
      );
      return { phase: 'ready', data: { ...d, projects, issues: upsert(d.issues, action.issue), activity: [...action.events, ...d.activity] } };
    }
    case 'issue-removed':
      return { phase: 'ready', data: { ...d, issues: d.issues.filter((i) => i.id !== action.id), activity: [...action.events, ...d.activity] } };
    case 'label':
      return { phase: 'ready', data: { ...d, labels: upsert(d.labels, action.label) } };
  }
}

export interface StoreActions {
  createProject(input: ProjectInput): Promise<Project | null>;
  updateProject(id: ID, patch: Partial<ProjectInput>): Promise<Project | null>;
  updateColumns(id: ID, columns: Column[], moves: Record<ID, ID>): Promise<boolean>;
  archiveProject(id: ID): Promise<boolean>;
  restoreProject(id: ID): Promise<boolean>;
  deleteProject(id: ID): Promise<boolean>;
  createIssue(projectId: ID, input: IssueInput): Promise<Issue | null>;
  updateIssue(id: ID, patch: Partial<IssueInput>): Promise<Issue | null>;
  moveIssue(id: ID, status: Status): Promise<boolean>;
  deleteIssue(id: ID): Promise<boolean>;
  createLabel(input: LabelInput): Promise<Label | null>;
}

interface StoreValue {
  data: Snapshot;
  usersById: Map<ID, User>;
  labelsById: Map<ID, Label>;
  currentUser: User;
  actions: StoreActions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' } as State);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      repo.load().then(
        (data) => !cancelled && dispatch({ type: 'loaded', data }),
        (err: unknown) => !cancelled && dispatch({ type: 'failed', message: err instanceof Error ? err.message : 'Could not load data.' }),
      );
    };
    reload();
    // Another tab changed the data: pick it up.
    const unsubscribe = repo.subscribe?.(reload);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [repo]);

  /** Runs a repository call; on failure shows an error toast and returns null. */
  const run = useCallback(
    async <T,>(what: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        toast.error(err instanceof ValidationError ? message : `Could not ${what}. ${message}`);
        return null;
      }
    },
    [toast],
  );

  const actions = useMemo<StoreActions>(
    () => ({
      async createProject(input) {
        const r = await run('create the project', () => repo.createProject(input));
        if (!r) return null;
        dispatch({ type: 'project', project: r.value, events: r.events });
        toast.success(`Project "${r.value.name}" created.`);
        return r.value;
      },
      async updateProject(id, patch) {
        const r = await run('save the project', () => repo.updateProject(id, patch));
        if (!r) return null;
        dispatch({ type: 'project', project: r.value, events: r.events });
        if (r.events.length) toast.success('Project saved.');
        return r.value;
      },
      async updateColumns(id, columns, moves) {
        const r = await run('save the columns', () => repo.updateColumns(id, columns, moves));
        if (!r) return false;
        dispatch({ type: 'columns', project: r.value, moves, events: r.events });
        if (r.events.length) toast.success('Columns saved.');
        return true;
      },
      async archiveProject(id) {
        const r = await run('archive the project', () => repo.archiveProject(id));
        if (!r) return false;
        dispatch({ type: 'project', project: r.value, events: r.events });
        toast.success(`"${r.value.name}" archived. You can restore it from the Projects page.`);
        return true;
      },
      async restoreProject(id) {
        const r = await run('restore the project', () => repo.restoreProject(id));
        if (!r) return false;
        dispatch({ type: 'project', project: r.value, events: r.events });
        toast.success(`"${r.value.name}" restored.`);
        return true;
      },
      async deleteProject(id) {
        const ok = await run('delete the project', async () => {
          await repo.deleteProject(id);
          return true;
        });
        if (!ok) return false;
        dispatch({ type: 'project-removed', id });
        toast.success('Project deleted.');
        return true;
      },
      async createIssue(projectId, input) {
        const r = await run('create the issue', () => repo.createIssue(projectId, input));
        if (!r) return null;
        dispatch({ type: 'issue', issue: r.value, events: r.events });
        toast.success('Issue created.');
        return r.value;
      },
      async updateIssue(id, patch) {
        const r = await run('save the issue', () => repo.updateIssue(id, patch));
        if (!r) return null;
        dispatch({ type: 'issue', issue: r.value, events: r.events });
        if (r.events.length) toast.success('Issue saved.');
        return r.value;
      },
      async moveIssue(id, status) {
        const r = await run('move the issue', () => repo.moveIssue(id, status));
        if (!r) return false;
        dispatch({ type: 'issue', issue: r.value, events: r.events });
        if (r.events.length) toast.success('Issue moved.');
        return true;
      },
      async deleteIssue(id) {
        const r = await run('delete the issue', () => repo.deleteIssue(id));
        if (!r) return false;
        dispatch({ type: 'issue-removed', id, events: r.events });
        toast.success('Issue deleted.');
        return true;
      },
      async createLabel(input) {
        const label = await run('create the label', () => repo.createLabel(input));
        if (!label) return null;
        dispatch({ type: 'label', label });
        return label;
      },
    }),
    [repo, run, toast],
  );

  const value = useMemo<StoreValue | null>(() => {
    if (state.phase !== 'ready') return null;
    const usersById = new Map(state.data.users.map((u) => [u.id, u]));
    const labelsById = new Map(state.data.labels.map((l) => [l.id, l]));
    const currentUser = usersById.get(state.data.currentUserId) ?? state.data.users[0];
    return { data: state.data, usersById, labelsById, currentUser, actions };
  }, [state, actions]);

  if (state.phase === 'loading') {
    return (
      <div className="boot" role="status">
        Loading your workspace...
      </div>
    );
  }
  if (state.phase === 'error' || !value) {
    return (
      <div className="boot boot-error" role="alert">
        <h1>Plumbline could not load your data</h1>
        <p>{state.phase === 'error' ? state.message : 'Unknown error.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
