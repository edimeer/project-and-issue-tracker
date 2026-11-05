import { LIMITS } from './constants';
import { isValidDateString } from './dates';
import { PRIORITIES, STATUSES } from './types';
import type { IssueInput, LabelInput, ProjectInput } from './types';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export class ValidationError<T = Record<string, unknown>> extends Error {
  readonly errors: FieldErrors<T>;
  constructor(errors: FieldErrors<T>) {
    super(Object.values(errors)[0] as string);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function validateProject(input: ProjectInput): FieldErrors<ProjectInput> {
  const errors: FieldErrors<ProjectInput> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Give the project a name.';
  else if (name.length > LIMITS.projectName) errors.name = `Keep the name under ${LIMITS.projectName} characters.`;
  if (input.description.length > LIMITS.projectDescription) {
    errors.description = `Keep the description under ${LIMITS.projectDescription} characters.`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) errors.color = 'Pick a colour.';
  return errors;
}

export function validateIssue(input: IssueInput): FieldErrors<IssueInput> {
  const errors: FieldErrors<IssueInput> = {};
  const title = input.title.trim();
  if (!title) errors.title = 'Give the issue a title.';
  else if (title.length > LIMITS.issueTitle) errors.title = `Keep the title under ${LIMITS.issueTitle} characters.`;
  if (input.description.length > LIMITS.issueDescription) {
    errors.description = `Keep the description under ${LIMITS.issueDescription} characters.`;
  }
  if (!STATUSES.includes(input.status)) errors.status = 'Choose a valid status.';
  if (!PRIORITIES.includes(input.priority)) errors.priority = 'Choose a valid priority.';
  if (input.dueDate !== null && !isValidDateString(input.dueDate)) {
    errors.dueDate = 'Enter a real date, like 2026-11-30.';
  }
  return errors;
}

export function validateLabel(input: LabelInput): FieldErrors<LabelInput> {
  const errors: FieldErrors<LabelInput> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Give the label a name.';
  else if (name.length > LIMITS.labelName) errors.name = `Keep label names under ${LIMITS.labelName} characters.`;
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
