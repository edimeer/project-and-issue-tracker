import type { ReactNode } from 'react';
import { issueRef } from '../domain/filters';
import type { LookupContext } from '../domain/filters';
import type { Issue, Project } from '../domain/types';
import { useStore } from '../state/store';
import { buildIssueMenu } from './issueMenu';
import { Avatar, DueChip, LabelChip, PriorityIcon } from './ui/Badges';
import { PRIORITY_META } from '../domain/constants';
import { Menu } from './ui/Menu';

interface Props {
  issue: Issue;
  project: Project;
  ctx: LookupContext;
  readOnly: boolean;
  onOpen: (issue: Issue) => void;
  onDelete: (issue: Issue) => void;
  /** Drag support (wide board only). */
  dragHandle?: ReactNode;
  className?: string;
  /** Presentational copy shown while dragging. */
  overlay?: boolean;
}

export function IssueCard({ issue, project, ctx, readOnly, onOpen, onDelete, dragHandle, className = '', overlay }: Props) {
  const { usersById, labelsById, actions } = useStore();
  const assignee = issue.assigneeId ? usersById.get(issue.assigneeId) : undefined;
  const labels = issue.labelIds.map((id) => labelsById.get(id)).filter((l) => !!l);
  const ref = issueRef(project, issue);
  const shownLabels = labels.slice(0, 2);

  return (
    <article className={`card ${className}${overlay ? ' card-overlay' : ''}`} aria-label={`${ref}: ${issue.title}`}>
      <div className="card-top">
        <span className="issue-ref">{ref}</span>
        <span className="card-priority" title={`${PRIORITY_META[issue.priority].label} priority`}>
          <PriorityIcon priority={issue.priority} />
          <span className="visually-hidden">{PRIORITY_META[issue.priority].label} priority</span>
        </span>
        <span className="card-top-spacer" />
        {!readOnly && dragHandle}
        {!overlay && (
          <Menu
            label={`Actions for ${ref}`}
            className="icon-btn icon-btn-sm"
            entries={buildIssueMenu({ issue, columns: project.columns, readOnly, actions, onOpen, onDelete })}
          />
        )}
      </div>
      <h3 className="card-title">
        <button type="button" className="card-title-btn" onClick={() => onOpen(issue)} tabIndex={overlay ? -1 : 0}>
          {issue.title}
        </button>
      </h3>
      {(shownLabels.length > 0 || labels.length > 2) && (
        <div className="card-labels">
          {shownLabels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {labels.length > 2 && <span className="more-count">+{labels.length - 2}</span>}
        </div>
      )}
      <div className="card-foot">
        {issue.dueDate ? <DueChip dueDate={issue.dueDate} done={ctx.doneIds.has(issue.status)} today={ctx.today} /> : <span />}
        {assignee ? <Avatar user={assignee} size={24} /> : <span className="unassigned" title="Unassigned">Unassigned</span>}
      </div>
    </article>
  );
}
