import { PRIORITY_META, STATUS_META } from '../../domain/constants';
import { describeDue, formatDate } from '../../domain/dates';
import type { Label, Priority, Status, User } from '../../domain/types';
import { Icon } from './Icon';

/** Each status has its own shape as well as its own colour, so it never relies on colour alone. */
export function StatusIcon({ status, size = 16 }: { status: Status; size?: number }) {
  return (
    <svg
      className={`status-icon status-${status}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {status === 'backlog' && (
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2.6" />
      )}
      {status === 'todo' && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />}
      {status === 'in_progress' && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 4.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor" />
        </>
      )}
      {status === 'in_review' && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 8V4.2A3.8 3.8 0 1 1 4.2 8Z" fill="currentColor" />
        </>
      )}
      {status === 'done' && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5 8.2 2.2 2.2L11 6.4" fill="none" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function PriorityIcon({ priority, size = 16 }: { priority: Priority; size?: number }) {
  const level = PRIORITY_META[priority].rank;
  return (
    <svg
      className={`priority-icon priority-${priority}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {priority === 'urgent' ? (
        <>
          <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor" />
          <path d="M8 4.5v4.2M8 11.2v.1" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" />
        </>
      ) : (
        [0, 1, 2].map((i) => (
          <rect
            key={i}
            x={2 + i * 4.5}
            y={10 - i * 3}
            width="3"
            height={4 + i * 3}
            rx="0.8"
            fill="currentColor"
            opacity={i < level ? 1 : 0.22}
          />
        ))
      )}
    </svg>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status}`}>
      <StatusIcon status={status} size={14} />
      {STATUS_META[status].label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge priority-${priority}`}>
      <PriorityIcon priority={priority} size={14} />
      {PRIORITY_META[priority].label}
    </span>
  );
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className="label-chip" style={{ ['--label' as string]: label.color }}>
      <span className="label-dot" aria-hidden="true" />
      {label.name}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

export function Avatar({ user, size = 24 }: { user: User; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.42) }}
      title={user.name}
      role="img"
      aria-label={user.name}
    >
      {initials(user.name)}
    </span>
  );
}

export function DueChip({ dueDate, status, today, verbose = false }: { dueDate: string; status: Status; today: string; verbose?: boolean }) {
  const done = status === 'done';
  const info = describeDue(dueDate, today);
  const tone = done ? 'normal' : info.tone;
  return (
    <span className={`due due-${tone}`} title={formatDate(dueDate)}>
      <Icon name="calendar" size={13} />
      <span>{verbose ? (done ? `Due ${formatDate(dueDate)}` : info.text) : formatDate(dueDate)}</span>
      {tone === 'overdue' && !verbose && <span className="visually-hidden"> (overdue)</span>}
    </span>
  );
}
