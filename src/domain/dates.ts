// All user-facing dates go through this file so formatting stays consistent.
// Due dates are calendar dates (YYYY-MM-DD) with no time zone; timestamps are ISO strings.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100) return false;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function toDateString(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now);
}

export function addDays(dateString: string, days: number): string {
  const m = DATE_RE.exec(dateString);
  if (!m) return dateString;
  return toDateString(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  const a = DATE_RE.exec(from);
  const b = DATE_RE.exec(to);
  if (!a || !b) return 0;
  const ua = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const ub = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((ub - ua) / 86_400_000);
}

/** "Nov 5, 2026" */
export function formatDate(dateString: string): string {
  const m = DATE_RE.exec(dateString);
  if (!m) return dateString;
  return dateFmt.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** "Nov 5, 2026, 3:42 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

/** "just now", "5m ago", "3h ago", "2d ago", then a plain date. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return dateFmt.format(d);
}

/** Describes a due date relative to today: "Due today", "Overdue by 3 days", "Due in 2 days", or the date. */
export function describeDue(dueDate: string, today: string): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  const delta = diffDays(today, dueDate);
  if (delta < 0) return { text: `Overdue by ${-delta} ${-delta === 1 ? 'day' : 'days'}`, tone: 'overdue' };
  if (delta === 0) return { text: 'Due today', tone: 'soon' };
  if (delta === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (delta <= 7) return { text: `Due in ${delta} days`, tone: 'soon' };
  return { text: `Due ${formatDate(dueDate)}`, tone: 'normal' };
}
