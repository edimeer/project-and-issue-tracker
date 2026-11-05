import type { Priority, Status } from './types';

export const STATUS_META: Record<Status, { label: string; hint: string }> = {
  backlog: { label: 'Backlog', hint: 'Not yet planned' },
  todo: { label: 'Todo', hint: 'Ready to start' },
  in_progress: { label: 'In Progress', hint: 'Being worked on' },
  in_review: { label: 'In Review', hint: 'Waiting for review' },
  done: { label: 'Done', hint: 'Finished' },
};

export const PRIORITY_META: Record<Priority, { label: string; rank: number }> = {
  low: { label: 'Low', rank: 1 },
  medium: { label: 'Medium', rank: 2 },
  high: { label: 'High', rank: 3 },
  urgent: { label: 'Urgent', rank: 4 },
};

export const PROJECT_COLORS = [
  '#1f4d3f',
  '#c2512d',
  '#2f5fa7',
  '#7a4a9e',
  '#b07a12',
  '#a63a55',
  '#3b7f86',
  '#5b6b2c',
];

export const LABEL_COLORS = ['#2f7d5b', '#c2512d', '#2f5fa7', '#7a4a9e', '#b07a12', '#a63a55', '#3b7f86', '#6b6f76'];

export const LIMITS = {
  projectName: 60,
  projectDescription: 280,
  issueTitle: 140,
  issueDescription: 5000,
  labelName: 24,
} as const;
