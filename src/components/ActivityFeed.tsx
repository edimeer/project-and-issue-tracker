import { formatDateTime, formatRelative } from '../domain/dates';
import type { ActivityEvent } from '../domain/types';
import { useStore } from '../state/store';
import { Avatar } from './ui/Badges';

function describe(e: ActivityEvent): string {
  const ref = e.data.issueRef ?? '';
  switch (e.type) {
    case 'project.created':
      return 'created the project';
    case 'project.updated':
      return e.data.from ? `renamed the project from "${e.data.from}"` : `updated the project ${(e.data.fields ?? []).join(', ')}`;
    case 'project.archived':
      return 'archived the project';
    case 'project.restored':
      return 'restored the project';
    case 'issue.created':
      return `created ${ref}`;
    case 'issue.status_changed':
      return `moved ${ref} from ${e.data.from} to ${e.data.to}`;
    case 'issue.updated':
      return `updated ${(e.data.fields ?? ['details']).join(', ')} on ${ref}`;
    case 'issue.deleted':
      return `deleted ${ref}`;
  }
}

interface ItemProps {
  event: ActivityEvent;
  compact?: boolean;
  onOpenIssue?: (issueId: string) => void;
}

export function ActivityItem({ event, compact, onOpenIssue }: ItemProps) {
  const { usersById, data } = useStore();
  const actor = usersById.get(event.actorId);
  const issueExists = !!event.issueId && data.issues.some((i) => i.id === event.issueId);
  const title = event.data.issueTitle;
  return (
    <li className="activity-item">
      {actor && !compact && <Avatar user={actor} size={28} />}
      <div className="activity-text">
        <p>
          <strong>{actor?.name ?? 'Someone'}</strong> {describe(event)}
        </p>
        {title && !compact && (
          <p className="activity-title">
            {issueExists && onOpenIssue ? (
              <button type="button" className="link-btn" onClick={() => onOpenIssue(event.issueId as string)}>
                {title}
              </button>
            ) : (
              <span>{title}</span>
            )}
          </p>
        )}
      </div>
      <time className="activity-time" dateTime={event.createdAt} title={formatDateTime(event.createdAt)}>
        {formatRelative(event.createdAt)}
      </time>
    </li>
  );
}

export function ActivityFeed({ events, onOpenIssue }: { events: ActivityEvent[]; onOpenIssue?: (issueId: string) => void }) {
  return (
    <ul className="activity-list">
      {events.map((e) => (
        <ActivityItem key={e.id} event={e} onOpenIssue={onOpenIssue} />
      ))}
    </ul>
  );
}
