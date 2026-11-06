import { useMemo } from 'react';
import { describeDue } from '../domain/dates';
import { doneIds } from '../domain/columns';
import { isOverdue, issueRef, upcomingDue } from '../domain/filters';
import { PRIORITY_META } from '../domain/constants';
import type { Issue, Project } from '../domain/types';
import { useStore } from '../state/store';
import { ActivityFeed } from './ActivityFeed';
import { Avatar, PriorityIcon, StatusIcon } from './ui/Badges';
import { EmptyState } from './ui/EmptyState';
import { Icon } from './ui/Icon';

interface Props {
  project: Project;
  issues: Issue[];
  today: string;
  readOnly: boolean;
  onOpen: (issue: Issue) => void;
  onCreate: () => void;
}

export function Overview({ project, issues, today, readOnly, onOpen, onCreate }: Props) {
  const { data } = useStore();

  const columns = project.columns;
  const doneSet = useMemo(() => doneIds(columns), [columns]);
  const counts = useMemo(() => {
    const c = new Map<string, number>(columns.map((col) => [col.id, 0]));
    for (const i of issues) c.set(i.status, (c.get(i.status) ?? 0) + 1);
    return c;
  }, [issues, columns]);

  const total = issues.length;
  const done = issues.filter((i) => doneSet.has(i.status)).length;
  const open = total - done;
  const overdue = issues.filter((i) => isOverdue(i, today, doneSet));
  const attention = issues
    .filter((i) => !doneSet.has(i.status) && (i.priority === 'urgent' || isOverdue(i, today, doneSet)))
    .sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
    .slice(0, 6);
  const upcoming = upcomingDue(issues, today, 14, doneSet).slice(0, 8);
  const activity = data.activity.filter((a) => a.projectId === project.id).slice(0, 10);

  if (total === 0) {
    return (
      <EmptyState
        icon="board"
        title="This project has no issues yet"
        action={
          !readOnly && (
            <button type="button" className="btn btn-primary" onClick={onCreate}>
              <Icon name="plus" size={16} /> Create the first issue
            </button>
          )
        }
      >
        Issues are the units of work in a project. Add one to start tracking progress.
      </EmptyState>
    );
  }

  return (
    <div className="overview">
      <section className="panel panel-wide" aria-labelledby="ov-status">
        <h2 id="ov-status" className="panel-title">
          Issues by column
        </h2>
        <div className="status-panel">
        <div className="gauge" role="img" aria-label={`${Math.round((done / total) * 100)}% of issues done`}>
          <span className="gauge-thread" />
          <span className="gauge-fill" style={{ height: `${(done / total) * 100}%` }} />
          <span className="gauge-bob" style={{ bottom: `${(done / total) * 100}%` }} />
          <span className="gauge-value">{Math.round((done / total) * 100)}%</span>
        </div>
        <div>
        <div className="progress-line">
          <div className="progress-bar" role="img" aria-label={`${done} of ${total} issues done`}>
            {columns.map((c) => (
              <span key={c.id} className={`progress-seg status-${c.kind}`} style={{ flexGrow: counts.get(c.id) ?? 0 }} />
            ))}
          </div>
          <p className="progress-text">
            <strong>{Math.round((done / total) * 100)}%</strong> done. {open} open, {overdue.length} overdue.
          </p>
        </div>
        <ul className="stat-grid">
          {columns.map((c) => (
            <li key={c.id} className={`stat status-${c.kind}`}>
              <span className="stat-label">
                <StatusIcon kind={c.kind} /> <span className="stat-name">{c.name}</span>
              </span>
              <span className="stat-value">{counts.get(c.id) ?? 0}</span>
            </li>
          ))}
        </ul>
        </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="ov-attn">
        <h2 id="ov-attn" className="panel-title">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="panel-empty">Nothing is urgent or overdue. Nice.</p>
        ) : (
          <ul className="mini-list">
            {attention.map((i) => (
              <MiniIssue key={i.id} issue={i} project={project} today={today} onOpen={onOpen} showReason />
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="ov-due">
        <h2 id="ov-due" className="panel-title">
          Due in the next 14 days
        </h2>
        {upcoming.length === 0 ? (
          <p className="panel-empty">No open issues are due soon.</p>
        ) : (
          <ul className="mini-list">
            {upcoming.map((i) => (
              <MiniIssue key={i.id} issue={i} project={project} today={today} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-wide" aria-labelledby="ov-activity">
        <h2 id="ov-activity" className="panel-title">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="panel-empty">No activity yet.</p>
        ) : (
          <ActivityFeed events={activity} onOpenIssue={(id) => {
            const issue = issues.find((i) => i.id === id);
            if (issue) onOpen(issue);
          }} />
        )}
      </section>
    </div>
  );
}

function MiniIssue({ issue, project, today, onOpen, showReason }: { issue: Issue; project: Project; today: string; onOpen: (i: Issue) => void; showReason?: boolean }) {
  const { usersById } = useStore();
  const assignee = issue.assigneeId ? usersById.get(issue.assigneeId) : undefined;
  const due = issue.dueDate ? describeDue(issue.dueDate, today) : null;
  return (
    <li className="mini">
      <PriorityIcon priority={issue.priority} />
      <div className="mini-main">
        <button type="button" className="row-title" onClick={() => onOpen(issue)}>
          <span className="issue-ref">{issueRef(project, issue)}</span> {issue.title}
        </button>
        <span className={`mini-meta${due?.tone === 'overdue' ? ' is-overdue' : ''}`}>
          {due ? due.text : 'No due date'}
          {showReason && issue.priority === 'urgent' ? ' - Urgent' : ''}
        </span>
      </div>
      {assignee && <Avatar user={assignee} size={22} />}
    </li>
  );
}
