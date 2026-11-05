import type { LookupContext } from '../domain/filters';
import type { Issue, Project } from '../domain/types';

/** Props shared by the board and list views. */
export interface IssueViewProps {
  project: Project;
  /** Issues after filtering (and sorting, for the list). */
  issues: Issue[];
  ctx: LookupContext;
  readOnly: boolean;
  /** True when filters hide every issue even though the project has some. */
  filtered: boolean;
  onOpen: (issue: Issue) => void;
  onDelete: (issue: Issue) => void;
  onCreate: (status?: import('../domain/types').Status) => void;
  onClearFilters: () => void;
}
