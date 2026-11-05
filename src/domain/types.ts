export type ID = string;

export const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface User {
  id: ID;
  name: string;
  email: string;
  /** Avatar background colour (hex). */
  color: string;
}

export interface Label {
  id: ID;
  name: string;
  /** Hex colour. */
  color: string;
}

export interface Project {
  id: ID;
  /** Short unique prefix used in issue references, e.g. "WEB" in WEB-12. */
  key: string;
  name: string;
  description: string;
  /** Accent colour (hex). */
  color: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Last issue number handed out in this project. Never reused after deletes. */
  issueCounter: number;
}

export interface Issue {
  id: ID;
  projectId: ID;
  /** Per-project sequence number. Display reference is `${project.key}-${number}`. */
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: ID | null;
  labelIds: ID[];
  /** Calendar date as YYYY-MM-DD (no time zone), or null. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'project.created'
  | 'project.updated'
  | 'project.archived'
  | 'project.restored'
  | 'issue.created'
  | 'issue.updated'
  | 'issue.status_changed'
  | 'issue.deleted';

export interface ActivityEvent {
  id: ID;
  projectId: ID;
  /** Null for project-level events. May point at a deleted issue. */
  issueId: ID | null;
  actorId: ID;
  type: ActivityType;
  /** Small denormalised payload so the feed still reads well after renames or deletes. */
  data: {
    issueRef?: string;
    issueTitle?: string;
    from?: string;
    to?: string;
    fields?: string[];
    projectName?: string;
  };
  createdAt: string;
}

/** Everything the app needs to render. A real API would serve this in pieces. */
export interface Snapshot {
  version: number;
  currentUserId: ID;
  users: User[];
  labels: Label[];
  projects: Project[];
  issues: Issue[];
  activity: ActivityEvent[];
}

export interface ProjectInput {
  name: string;
  description: string;
  color: string;
}

export interface IssueInput {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: ID | null;
  labelIds: ID[];
  dueDate: string | null;
}

export interface LabelInput {
  name: string;
  color: string;
}
