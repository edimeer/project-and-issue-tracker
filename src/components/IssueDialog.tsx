import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LABEL_COLORS, LIMITS, PRIORITY_META, STATUS_META } from '../domain/constants';
import { formatDateTime } from '../domain/dates';
import { issueRef } from '../domain/filters';
import { PRIORITIES, STATUSES } from '../domain/types';
import type { IssueInput, Priority, Project, Status } from '../domain/types';
import { hasErrors, validateIssue } from '../domain/validation';
import type { FieldErrors } from '../domain/validation';
import { useStore } from '../state/store';
import { ActivityItem } from './ActivityFeed';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { Icon } from './ui/Icon';

interface Props {
  project: Project;
  /** Omit to create a new issue. */
  issueId?: string;
  initialStatus?: Status;
  onClose: () => void;
}

export function IssueDialog({ project, issueId, initialStatus, onClose }: Props) {
  const { data, actions, usersById, currentUser } = useStore();
  const issue = issueId ? data.issues.find((i) => i.id === issueId) : undefined;
  const readOnly = !!project.archivedAt;

  const initial = useMemo<IssueInput>(
    () => ({
      title: issue?.title ?? '',
      description: issue?.description ?? '',
      status: issue?.status ?? initialStatus ?? 'todo',
      priority: issue?.priority ?? 'medium',
      assigneeId: issue ? issue.assigneeId : null,
      labelIds: issue?.labelIds ?? [],
      dueDate: issue?.dueDate ?? null,
    }),
    // Only the first render matters: later store updates must not overwrite what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [values, setValues] = useState<IssueInput>(initial);
  const [errors, setErrors] = useState<FieldErrors<IssueInput>>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelError, setNewLabelError] = useState('');

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = <K extends keyof IssueInput>(key: K, value: IssueInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  function requestClose() {
    if (dirty && !readOnly) setConfirm('discard');
    else onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const found = validateIssue(values);
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('dialog [aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    const saved = issue ? await actions.updateIssue(issue.id, values) : await actions.createIssue(project.id, values);
    setSaving(false);
    if (saved) onClose();
  }

  async function addLabel() {
    const name = newLabel.trim();
    if (!name) return;
    const label = await actions.createLabel({ name, color: LABEL_COLORS[data.labels.length % LABEL_COLORS.length] });
    if (label) {
      setValues((v) => (v.labelIds.includes(label.id) ? v : { ...v, labelIds: [...v.labelIds, label.id] }));
      setNewLabel('');
      setNewLabelError('');
    } else {
      setNewLabelError('Could not add that label.');
    }
  }

  const history = issue ? data.activity.filter((a) => a.issueId === issue.id).slice(0, 8) : [];
  const creator = issue ? data.activity.find((a) => a.issueId === issue.id && a.type === 'issue.created') : undefined;

  if (issueId && !issue) {
    // The issue disappeared (deleted elsewhere). Nothing sensible to show.
    return (
      <Dialog title="Issue not found" onClose={onClose}>
        <p>This issue no longer exists. It may have been deleted in another tab.</p>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        variant="drawer"
        title={issue ? issueRef(project, issue) : `New issue in ${project.name}`}
        onClose={requestClose}
        lockBackdrop={dirty}
        footer={
          readOnly ? (
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              {issue && (
                <button type="button" className="btn btn-ghost-danger push-left" onClick={() => setConfirm('delete')}>
                  <Icon name="trash" size={16} /> Delete
                </button>
              )}
              <button type="button" className="btn" onClick={requestClose}>
                Cancel
              </button>
              <button type="submit" form="issue-form" className="btn btn-primary" disabled={saving}>
                {issue ? 'Save changes' : 'Create issue'}
              </button>
            </>
          )
        }
      >
        {readOnly && (
          <p className="notice" role="note">
            This project is archived, so its issues are read-only. Restore the project to edit them.
          </p>
        )}
        <form id="issue-form" onSubmit={submit} noValidate className="form-stack">
          <Field label="Title" required error={errors.title} counter={`${values.title.length}/${LIMITS.issueTitle}`}>
            {(p) => (
              <textarea
                {...p}
                className="input textarea title-input"
                rows={2}
                data-autofocus={issue ? undefined : ''}
                value={values.title}
                disabled={readOnly}
                onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="What needs to happen?"
              />
            )}
          </Field>
          <Field label="Description" error={errors.description} counter={`${values.description.length}/${LIMITS.issueDescription}`}>
            {(p) => (
              <textarea
                {...p}
                className="input textarea"
                rows={6}
                value={values.description}
                disabled={readOnly}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Add context, steps to reproduce, or acceptance criteria."
              />
            )}
          </Field>

          <div className="form-grid">
            <Field label="Status" error={errors.status}>
              {(p) => (
                <select {...p} className="input" value={values.status} disabled={readOnly} onChange={(e) => set('status', e.target.value as Status)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Priority" error={errors.priority}>
              {(p) => (
                <select {...p} className="input" value={values.priority} disabled={readOnly} onChange={(e) => set('priority', e.target.value as Priority)}>
                  {PRIORITIES.map((s) => (
                    <option key={s} value={s}>
                      {PRIORITY_META[s].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Assignee">
              {(p) => (
                <select
                  {...p}
                  className="input"
                  value={values.assigneeId ?? ''}
                  disabled={readOnly}
                  onChange={(e) => set('assigneeId', e.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUser.id ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Due date" error={errors.dueDate}>
              {(p) => (
                <div className="date-row">
                  <input
                    {...p}
                    type="date"
                    className="input"
                    min="1900-01-01"
                    max="2100-12-31"
                    value={values.dueDate ?? ''}
                    disabled={readOnly}
                    onChange={(e) => set('dueDate', e.target.value || null)}
                  />
                  {values.dueDate && !readOnly && (
                    <button type="button" className="icon-btn" onClick={() => set('dueDate', null)} aria-label="Clear due date">
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              )}
            </Field>
          </div>

          <fieldset className="fieldset" disabled={readOnly}>
            <legend className="field-label">Labels</legend>
            <div className="chip-picker">
              {data.labels.map((l) => {
                const on = values.labelIds.includes(l.id);
                return (
                  <label key={l.id} className={`chip-toggle${on ? ' is-on' : ''}`} style={{ ['--label' as string]: l.color }}>
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={on}
                      onChange={() => set('labelIds', on ? values.labelIds.filter((x) => x !== l.id) : [...values.labelIds, l.id])}
                    />
                    <span className="label-dot" aria-hidden="true" />
                    {l.name}
                    {on && <Icon name="check" size={13} />}
                  </label>
                );
              })}
            </div>
            {!readOnly && (
              <div className="inline-add">
                <label className="visually-hidden" htmlFor="new-label">
                  New label name
                </label>
                <input
                  id="new-label"
                  className="input input-sm"
                  value={newLabel}
                  maxLength={LIMITS.labelName}
                  placeholder="New label"
                  aria-invalid={newLabelError ? true : undefined}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setNewLabelError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addLabel();
                    }
                  }}
                />
                <button type="button" className="btn btn-sm" onClick={() => void addLabel()} disabled={!newLabel.trim()}>
                  <Icon name="plus" size={14} /> Add label
                </button>
                {newLabelError && <p className="field-error">{newLabelError}</p>}
              </div>
            )}
          </fieldset>
        </form>

        {issue && (
          <section className="issue-meta" aria-label="Issue history">
            <p className="meta-line">
              Created {formatDateTime(issue.createdAt)}
              {creator ? ` by ${usersById.get(creator.actorId)?.name ?? 'someone'}` : ''}. Updated {formatDateTime(issue.updatedAt)}.
            </p>
            {history.length > 0 && (
              <>
                <h3 className="meta-heading">History</h3>
                <ul className="activity-list compact">
                  {history.map((e) => (
                    <ActivityItem key={e.id} event={e} compact />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </Dialog>

      {confirm === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={onClose}
        >
          <p>You have edits that have not been saved. If you leave now they will be lost.</p>
        </ConfirmDialog>
      )}
      {confirm === 'delete' && issue && (
        <ConfirmDialog
          title="Delete this issue?"
          confirmLabel="Delete issue"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const ok = await actions.deleteIssue(issue.id);
            if (ok) onClose();
            else setConfirm(null);
          }}
        >
          <p>
            <strong className="wrap-anywhere">{issueRef(project, issue)}: {issue.title}</strong> will be permanently deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
