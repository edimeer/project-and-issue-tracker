import { addDays, todayString } from '../domain/dates';
import type { ActivityEvent, Issue, Label, Priority, Project, Snapshot, Status, User } from '../domain/types';

export const SNAPSHOT_VERSION = 1;

const users: User[] = [
  { id: 'u_maya', name: 'Maya Chen', email: 'maya@example.com', color: '#1f4d3f' },
  { id: 'u_dev', name: 'Dev Patel', email: 'dev@example.com', color: '#2f5fa7' },
  { id: 'u_sofia', name: 'Sofia Alvarez', email: 'sofia@example.com', color: '#a63a55' },
  { id: 'u_jonas', name: 'Jonas Weber', email: 'jonas@example.com', color: '#7a4a9e' },
  { id: 'u_amara', name: 'Amara Okafor', email: 'amara@example.com', color: '#b07a12' },
];

const labels: Label[] = [
  { id: 'l_bug', name: 'bug', color: '#a63a55' },
  { id: 'l_feature', name: 'feature', color: '#2f7d5b' },
  { id: 'l_design', name: 'design', color: '#7a4a9e' },
  { id: 'l_docs', name: 'docs', color: '#2f5fa7' },
  { id: 'l_perf', name: 'performance', color: '#b07a12' },
  { id: 'l_a11y', name: 'accessibility', color: '#3b7f86' },
  { id: 'l_debt', name: 'tech debt', color: '#6b6f76' },
  { id: 'l_research', name: 'research', color: '#c2512d' },
];

type Row = [
  title: string,
  description: string,
  status: Status,
  priority: Priority,
  assignee: string | null,
  labelIds: string[],
  dueOffsetDays: number | null,
  createdDaysAgo: number,
];

const WEB: Row[] = [
  ['Replace hero image with responsive srcset', 'The hero is a single 2.4 MB JPEG. Export 480, 960 and 1920 px widths in AVIF and WebP and serve them with srcset and sizes.', 'in_progress', 'high', 'u_dev', ['l_perf'], 2, 9],
  ['Navigation collapses incorrectly between 768 and 900 px', 'At tablet widths the menu shows both the hamburger and the full link list. Steps: open the site at 800 px wide and reload.', 'todo', 'high', 'u_sofia', ['l_bug', 'l_design'], 1, 7],
  ['Write copy for the pricing page', 'Three tiers, plain language, no jargon. Legal needs to review the refund wording before we publish.', 'in_review', 'medium', 'u_amara', ['l_docs'], 4, 12],
  ['Audit colour contrast across the marketing site', 'Run the full site through an automated checker, then manually verify the buttons on tinted backgrounds. Target WCAG AA for all text.', 'todo', 'high', 'u_maya', ['l_a11y'], 6, 6],
  ['Add skip-to-content link and landmark roles', '', 'done', 'medium', 'u_maya', ['l_a11y'], -3, 20],
  ['Set up image CDN and cache headers', 'Long-lived immutable caching for hashed assets, short caching for HTML. Document the purge process.', 'done', 'medium', 'u_jonas', ['l_perf', 'l_debt'], -6, 24],
  ['Contact form silently fails when the email contains a plus sign', 'The server rejects addresses like name+tag@example.com and the form shows no error. Fix validation on both sides and show a message on failure.', 'in_progress', 'urgent', 'u_dev', ['l_bug'], 0, 3],
  ['Redesign the footer', 'Group links by topic, add the newsletter signup, and keep it under 320 px tall on mobile.', 'backlog', 'low', null, ['l_design'], null, 30],
  ['Case study: how Northfield cut onboarding time in half', 'Interview notes are in the shared drive. Aim for 600 words with two pull quotes and a before/after chart.', 'backlog', 'medium', 'u_amara', ['l_docs'], 21, 14],
  ['Migrate blog from markdown files to the CMS', 'Move 48 posts, keep URLs identical, and set up 301 redirects for anything that changes. Check that images still resolve.', 'todo', 'medium', 'u_jonas', ['l_debt'], 14, 10],
  ['Dark mode for the documentation section', 'Docs already use CSS variables for colour. Needs a toggle that respects prefers-color-scheme and remembers the choice.', 'backlog', 'low', null, ['l_feature', 'l_design'], null, 18],
  ['Lighthouse score below 90 on mobile', 'Largest Contentful Paint is 3.8 s on a throttled connection. Hero image and web font loading are the main suspects.', 'in_review', 'high', 'u_dev', ['l_perf'], -1, 11],
  ['Research: analytics without cookies', 'Compare Plausible, Fathom and a self-hosted option. We want page views and referrers only, with no consent banner.', 'done', 'low', 'u_sofia', ['l_research'], -10, 26],
];

const MOB: Row[] = [
  ['App crashes on launch on Android 12 devices', 'Reported by 14 users since release 2.3. Stack trace points at the splash screen theme. Reproduces on a Pixel 4a.', 'in_progress', 'urgent', 'u_jonas', ['l_bug'], 1, 4],
  ['Offline mode for the task list', 'Cache the last synced list, queue edits locally, and reconcile on reconnect. Conflicts: last write wins, but show a notice.', 'todo', 'high', 'u_dev', ['l_feature'], 18, 15],
  ['Biometric sign-in', 'Face ID and fingerprint after the first password sign-in. Fall back to the passcode, never to the account password.', 'backlog', 'medium', null, ['l_feature'], null, 22],
  ['Push notification permission prompt appears too early', 'We ask on first launch before the user has seen any value. Move the prompt to after the first task is created.', 'todo', 'medium', 'u_sofia', ['l_design'], 8, 8],
  ['VoiceOver reads the bottom tab bar in the wrong order', 'Tabs are announced right to left on iOS 17. Check the accessibility traits and the view hierarchy.', 'in_review', 'high', 'u_maya', ['l_a11y', 'l_bug'], 3, 6],
  ['Reduce cold start time below 2 seconds', 'Currently 3.4 s on a mid-range phone. Defer analytics initialisation and lazy load the settings module.', 'in_progress', 'medium', 'u_jonas', ['l_perf'], 10, 13],
  ['Update the onboarding illustrations', 'New brand palette. Four screens, delivered as vector assets at 1x, 2x and 3x.', 'done', 'low', 'u_sofia', ['l_design'], -5, 28],
  ['Crash reporting dashboard', 'Wire up the crash reporter and set an alert when the crash-free rate drops under 99.5 percent.', 'done', 'medium', 'u_dev', ['l_debt'], -8, 30],
  ['Swipe to complete conflicts with the back gesture', 'On iOS the left-edge swipe triggers navigation back instead of completing the task. Add an edge inset.', 'todo', 'medium', 'u_amara', ['l_bug'], -2, 9],
  ['Tablet layout for the planner screen', 'Two-pane layout above 700 pt wide. List on the left, detail on the right.', 'backlog', 'low', null, ['l_design', 'l_feature'], null, 25],
];

const OPS: Row[] = [
  ['Automate weekly invoice export', 'Finance asks for a CSV every Monday at 8:00. Generate it from the billing database and email it to the finance list.', 'todo', 'medium', 'u_jonas', ['l_feature'], 12, 11],
  ['Rotate shared service credentials', 'Move credentials into the password manager vault and remove them from the wiki. Rotate after the move.', 'in_progress', 'urgent', 'u_dev', ['l_debt'], 2, 5],
  ['Onboarding checklist for new hires', 'One page: accounts to request, people to meet, first-week reading. Review with HR.', 'in_review', 'low', 'u_amara', ['l_docs'], 9, 16],
  ['Slack bot posts duplicate standup reminders', 'Two instances of the bot are running after the last deploy. Remove the old one and add a startup lock.', 'done', 'medium', 'u_jonas', ['l_bug'], -4, 14],
  ['Evaluate a shared design tool licence', 'Three vendors, 12 seats. Compare cost, export formats, and offline support.', 'backlog', 'low', 'u_sofia', ['l_research'], null, 27],
];

const OLD: Row[] = [
  ['Draft job description for a support engineer', 'Align with the leadership team on scope and salary band before posting.', 'done', 'medium', 'u_amara', ['l_docs'], -40, 70],
  ['Set up careers page', 'Simple list of open roles with an apply link.', 'done', 'low', 'u_dev', ['l_feature'], -35, 66],
];

function iso(daysAgo: number, hour: number, now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
  return d.toISOString();
}

/** Builds fresh sample data. Dates are relative to `now` so the overview always has something to show. */
export function createSeed(now: Date = new Date()): Snapshot {
  const today = todayString(now);
  const projects: Project[] = [];
  const issues: Issue[] = [];
  const activity: ActivityEvent[] = [];
  let eventSeq = 0;

  const defs: { id: string; key: string; name: string; description: string; color: string; rows: Row[]; archived: boolean; age: number }[] = [
    { id: 'p_web', key: 'WEB', name: 'Website relaunch', description: 'New marketing site: faster, accessible, and easier for the team to edit.', color: '#1f4d3f', rows: WEB, archived: false, age: 34 },
    { id: 'p_mob', key: 'MOB', name: 'Mobile app 2.4', description: 'Stability fixes and offline support for the next mobile release.', color: '#2f5fa7', rows: MOB, archived: false, age: 32 },
    { id: 'p_ops', key: 'OPS', name: 'Internal tools', description: 'Small automations and housekeeping that keep the team moving.', color: '#b07a12', rows: OPS, archived: false, age: 29 },
    { id: 'p_hire', key: 'HIRE', name: 'Support hiring', description: 'Finished last quarter. Kept for reference.', color: '#7a4a9e', rows: OLD, archived: true, age: 75 },
  ];

  for (const def of defs) {
    const created = iso(def.age, 9, now);
    projects.push({
      id: def.id,
      key: def.key,
      name: def.name,
      description: def.description,
      color: def.color,
      archivedAt: def.archived ? iso(20, 15, now) : null,
      createdAt: created,
      updatedAt: def.archived ? iso(20, 15, now) : created,
      issueCounter: def.rows.length,
    });
    activity.push({
      id: `e_${eventSeq++}`,
      projectId: def.id,
      issueId: null,
      actorId: 'u_maya',
      type: 'project.created',
      data: { projectName: def.name },
      createdAt: created,
    });
    if (def.archived) {
      activity.push({
        id: `e_${eventSeq++}`,
        projectId: def.id,
        issueId: null,
        actorId: 'u_maya',
        type: 'project.archived',
        data: { projectName: def.name },
        createdAt: iso(20, 15, now),
      });
    }

    def.rows.forEach((row, idx) => {
      const [title, description, status, priority, assignee, labelIds, dueOffset, ageDays] = row;
      const number = idx + 1;
      const createdAt = iso(ageDays, 10 + (idx % 6), now);
      const touchedDaysAgo = status === 'backlog' ? ageDays : Math.max(0, Math.min(ageDays - 1, (idx * 3) % 7));
      const updatedAt = iso(touchedDaysAgo, 11 + (idx % 5), now);
      const id = `i_${def.key.toLowerCase()}_${number}`;
      issues.push({
        id,
        projectId: def.id,
        number,
        title,
        description,
        status,
        priority,
        assigneeId: assignee,
        labelIds,
        dueDate: dueOffset === null ? null : addDays(today, dueOffset),
        createdAt,
        updatedAt,
      });
      const ref = `${def.key}-${number}`;
      const creator = users[(idx + 1) % users.length].id;
      activity.push({
        id: `e_${eventSeq++}`,
        projectId: def.id,
        issueId: id,
        actorId: creator,
        type: 'issue.created',
        data: { issueRef: ref, issueTitle: title },
        createdAt,
      });
      if (status !== 'backlog') {
        activity.push({
          id: `e_${eventSeq++}`,
          projectId: def.id,
          issueId: id,
          actorId: assignee ?? creator,
          type: 'issue.status_changed',
          data: { issueRef: ref, issueTitle: title, from: 'Backlog', to: status === 'todo' ? 'Todo' : status === 'in_progress' ? 'In Progress' : status === 'in_review' ? 'In Review' : 'Done' },
          createdAt: updatedAt,
        });
      }
    });
  }

  activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    version: SNAPSHOT_VERSION,
    currentUserId: 'u_maya',
    users,
    labels,
    projects,
    issues,
    activity,
  };
}
