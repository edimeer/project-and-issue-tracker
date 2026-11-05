import { useMemo } from 'react';
import { STATUS_META } from '../domain/constants';
import { describeDue } from '../domain/dates';
import { isOverdue, issueRef, upcomingDue } from '../domain/filters';
import { PRIORITY_META } from '../domain/constants';
import { STATUSES } from '../domain/types';
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

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<(typeof STATUSES)[number], number>;
    for (const i of issues) c[i.status] += 1;
    return c;
  }, [issues]);

  const total = issues.length;
  const done = counts.done;
  const open = total - done;
  const overdue = issues.filter((i) => isOverdue(i, today));
  const attention = issues
    .filter((i) => i.status !== 'done' && (i.priority === 'urgent' || isOverdue(i, today)))
    .sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
    .slice(0, 6);
  const upcoming = upcomingDue(issues, today, 14).slice(0, 8);
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
          Issues by status
        </h2>
        <div className="progress-line">
          <div className="progress-bar" role="img" aria-label={`${done} of ${total} issues done`}>
            {STATUSES.map((s) => (
              <span key={s} className={`progress-seg status-${s}`} style={{ flexGrow: counts[s] }} />
            ))}
          </div>
          <p className="progress-text">
            <strong>{Math.round((done / total) * 100)}%</strong> done. {open} open, {overdue.length} overdue.
          </p>
        </div>
        <ul className="stat-grid">
          {STATUSES.map((s) => (
            <li key={s} className={`stat status-${s}`}>
              <span className="stat-label">
                <StatusIcon status={s} /> {STATUS_META[s].label}
              </span>
              <span className="stat-value">{counts[s]}</span>
            </li>
          ))}
        </ul>
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
