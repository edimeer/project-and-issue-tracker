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
} from '../domain/types';

/** Result of any write: the changed record plus the activity events the write produced. */
export interface Mutation<T> {
  value: T;
  events: ActivityEvent[];
}

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * The only way the UI reads or writes data. The browser implementation lives in
 * localStorageRepository.ts. A Rails-backed implementation would implement the same
 * interface with fetch calls (see docs/api.md for the matching endpoints).
 */
export interface Repository {
  load(): Promise<Snapshot>;

  createProject(input: ProjectInput): Promise<Mutation<Project>>;
  updateProject(id: ID, patch: Partial<ProjectInput>): Promise<Mutation<Project>>;
  archiveProject(id: ID): Promise<Mutation<Project>>;
  restoreProject(id: ID): Promise<Mutation<Project>>;
  /**
   * Replaces the project's columns. New columns carry client-made ids. A column that is
   * removed must have an entry in `moves` saying which remaining column takes its issues.
   */
  updateColumns(id: ID, columns: Column[], moves: Record<ID, ID>): Promise<Mutation<Project>>;
  /** Permanently removes the project, its issues and its activity. */
  deleteProject(id: ID): Promise<void>;

  createIssue(projectId: ID, input: IssueInput): Promise<Mutation<Issue>>;
  updateIssue(id: ID, patch: Partial<IssueInput>): Promise<Mutation<Issue>>;
  moveIssue(id: ID, status: Status): Promise<Mutation<Issue>>;
  deleteIssue(id: ID): Promise<Mutation<{ id: ID }>>;

  createLabel(input: LabelInput): Promise<Label>;

  /** Replaces all data with the built-in sample data. */
  resetToSample(): Promise<Snapshot>;

  /** Optional: called when data changed somewhere else (another tab, a server push). Returns an unsubscribe function. */
  subscribe?(listener: () => void): () => void;
}
