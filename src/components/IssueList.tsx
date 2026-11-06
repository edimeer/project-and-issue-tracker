import { useMemo, useState } from 'react';
import { PRIORITY_META } from '../domain/constants';
import { groupIssues, issueRef } from '../domain/filters';
import type { GroupBy, SortField, SortState } from '../domain/filters';
import type { Issue } from '../domain/types';
import { useStore } from '../state/store';
import { buildIssueMenu } from './issueMenu';
import type { IssueViewProps } from './viewTypes';
import { Avatar, DueChip, LabelChip, PriorityBadge, StatusBadge, StatusIcon } from './ui/Badges';
import { EmptyState } from './ui/EmptyState';
import { Icon } from './ui/Icon';
import { Menu } from './ui/Menu';

const PAGE = 50;

interface Props extends IssueViewProps {
  groupBy: GroupBy;
  sort: SortState;
  onSort: (field: SortField) => void;
}

const HEADERS: { field: SortField; label: string; className: string }[] = [
  { field: 'title', label: 'Title', className: 'col-title' },
  { field: 'status', label: 'Status', className: 'col-status' },
  { field: 'priority', label: 'Priority', className: 'col-priority' },
  { field: 'due', label: 'Due', className: 'col-due' },
];

export function IssueList({ issues, project, ctx, readOnly, filtered, groupBy, sort, onSort, onOpen, onDelete, onClearFilters }: Props) {
  const groups = useMemo(() => groupIssues(issues, groupBy, ctx), [issues, groupBy, ctx]);

  if (issues.length === 0 && filtered) {
    return (
      <EmptyState
        icon="filter"
        title="No issues match your filters"
        action={
          <button type="button" className="btn" onClick={onClearFilters}>
            Clear filters
          </button>
        }
      >
        Try a different search or remove some filters.
      </EmptyState>
    );
  }

  return (
    <div className="issue-list">
      <div className="list-head" role="group" aria-label="Sort issues">
        {HEADERS.map((h) => {
          const on = sort.field === h.field;
          return (
            <button
              key={h.field}
              type="button"
              className={`sort-btn ${h.className}${on ? ' is-on' : ''}`}
              onClick={() => onSort(h.field)}
              aria-label={`Sort by ${h.label}${on ? `, currently ${sort.dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
            >
              {h.label}
              {on && <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} />}
            </button>
          );
        })}
      </div>
      {groups.map((g) => (
        <Group key={g.key} groupKey={g.key} label={groupBy === 'none' ? null : g.label} groupBy={groupBy} issues={g.issues} {...{ project, ctx, readOnly, onOpen, onDelete }} />
      ))}
    </div>
  );
}

interface GroupProps extends Pick<IssueViewProps, 'project' | 'ctx' | 'readOnly' | 'onOpen' | 'onDelete'> {
  groupKey: string;
  label: string | null;
  groupBy: GroupBy;
  issues: Issue[];
}

function Group({ groupKey, label, groupBy, issues, project, ctx, readOnly, onOpen, onDelete }: GroupProps) {
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const panelId = `group-${groupBy}-${groupKey}`;
  const columnOfGroup = project.columns.find((c) => c.id === groupKey);
  return (
    <section className="list-group">
      {label !== null && (
        <h2 className="group-title">
          <button type="button" className="group-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} />
            {groupBy === 'status' && columnOfGroup && <StatusIcon kind={columnOfGroup.kind} />}
            <span>{label}</span>
            <span className="count">{issues.length}</span>
          </button>
        </h2>
      )}
      {open && (
        <ul id={panelId} className="rows">
          {issues.slice(0, limit).map((issue) => (
            <Row key={issue.id} {...{ issue, project, ctx, readOnly, onOpen, onDelete }} />
          ))}
          {issues.length > limit && (
            <li className="rows-more">
              <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + PAGE)}>
                Show {Math.min(PAGE, issues.length - limit)} more ({issues.length - limit} hidden)
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function Row({ issue, project, ctx, readOnly, onOpen, onDelete }: Pick<IssueViewProps, 'project' | 'ctx' | 'readOnly' | 'onOpen' | 'onDelete'> & { issue: Issue }) {
  const { usersById, labelsById, actions } = useStore();
  const assignee = issue.assigneeId ? usersById.get(issue.assigneeId) : undefined;
  const labels = issue.labelIds.map((id) => labelsById.get(id)).filter((l) => !!l);
  const ref = issueRef(project, issue);
  const column = project.columns.find((c) => c.id === issue.status);

  return (
    <li className="row">
      <span className="issue-ref row-ref">{ref}</span>
      <div className="row-main">
        <button type="button" className="row-title" onClick={() => onOpen(issue)}>
          {issue.title}
        </button>
        {labels.length > 0 && (
          <span className="row-labels">
            {labels.slice(0, 3).map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
            {labels.length > 3 && <span className="more-count">+{labels.length - 3}</span>}
          </span>
        )}
      </div>
      <span className="row-status">
        {readOnly ? (
          <StatusBadge column={column} />
        ) : (
          <Menu
            label={`Move ${ref} to another column, currently ${column?.name ?? 'unknown'}`}
            align="start"
            className="badge-btn"
            trigger={<StatusBadge column={column} />}
            entries={project.columns.map((c) => ({
              kind: 'item' as const,
              label: c.name,
              icon: <StatusIcon kind={c.kind} />,
              checked: issue.status === c.id,
              onSelect: () => void actions.moveIssue(issue.id, c.id),
            }))}
          />
        )}
      </span>
      <span className="row-priority" title={`${PRIORITY_META[issue.priority].label} priority`}>
        <PriorityBadge priority={issue.priority} />
      </span>
      <span className="row-assignee">{assignee ? <Avatar user={assignee} size={24} /> : <span className="unassigned" title="Unassigned">-</span>}</span>
      <span className="row-due">{issue.dueDate ? <DueChip dueDate={issue.dueDate} done={ctx.doneIds.has(issue.status)} today={ctx.today} /> : <span className="muted">No date</span>}</span>
      <span className="row-menu">
        <Menu
          label={`Actions for ${ref}`}
          entries={buildIssueMenu({ issue, columns: project.columns, readOnly, actions, onOpen, onDelete })}
        />
      </span>
    </li>
  );
}
