import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { newId } from '../data/ids';
import { validateColumns } from '../domain/columns';
import { KIND_META, LIMITS } from '../domain/constants';
import { COLUMN_KINDS } from '../domain/types';
import type { Column, ColumnKind, ID, Project } from '../domain/types';
import { useStore } from '../state/store';
import { StatusIcon } from './ui/Badges';
import { Dialog } from './ui/Dialog';
import { Icon } from './ui/Icon';

interface Row {
  column: Column;
  removed: boolean;
}

interface Props {
  project: Project;
  /** Focus a fresh, empty column straight away (used by the board's "Add column" button). */
  startWithNew?: boolean;
  onClose: () => void;
}

export function ColumnsDialog({ project, startWithNew, onClose }: Props) {
  const { data, actions } = useStore();
  const [rows, setRows] = useState<Row[]>(() => {
    const base = project.columns.map((c) => ({ column: { ...c }, removed: false }));
    return startWithNew ? [...base, { column: { id: newId('c'), name: '', kind: 'in_progress' as ColumnKind }, removed: false }] : base;
  });
  const [moveTo, setMoveTo] = useState<Record<ID, ID>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const focusId = useRef<ID | null>(startWithNew ? rows[rows.length - 1].column.id : null);
  const inputs = useRef<Record<ID, HTMLInputElement | null>>({});

  useEffect(() => {
    if (focusId.current) {
      inputs.current[focusId.current]?.focus();
      focusId.current = null;
    }
  });

  const counts = new Map<ID, number>();
  for (const i of data.issues) if (i.projectId === project.id) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  const originalIds = new Set(project.columns.map((c) => c.id));
  const kept = rows.filter((r) => !r.removed);

  /** Where a removed column's issues go unless the person picks otherwise: the next kept column, else the previous one. */
  function defaultTarget(id: ID): ID {
    const at = rows.findIndex((r) => r.column.id === id);
    const after = rows.slice(at + 1).find((r) => !r.removed);
    const before = rows.slice(0, at).reverse().find((r) => !r.removed);
    return (after ?? before ?? kept[0]).column.id;
  }

  const patch = (id: ID, change: Partial<Column>) =>
    setRows((rs) => rs.map((r) => (r.column.id === id ? { ...r, column: { ...r.column, ...change } } : r)));

  function move(index: number, dir: -1 | 1) {
    setRows((rs) => {
      const next = [...rs];
      const target = index + dir;
      if (target < 0 || target >= next.length) return rs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function add() {
    const id = newId('c');
    focusId.current = id;
    setRows((rs) => [...rs, { column: { id, name: '', kind: 'in_progress' }, removed: false }]);
  }

  function remove(id: ID) {
    if (!originalIds.has(id)) {
      setRows((rs) => rs.filter((r) => r.column.id !== id));
    } else {
      setRows((rs) => rs.map((r) => (r.column.id === id ? { ...r, removed: true } : r)));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const columns = kept.map((r) => ({ ...r.column, name: r.column.name.trim() }));
    const problem = validateColumns(columns);
    if (problem) {
      setError(problem);
      return;
    }
    const moves: Record<ID, ID> = {};
    for (const r of rows) {
      if (r.removed && (counts.get(r.column.id) ?? 0) > 0) moves[r.column.id] = moveTo[r.column.id] ?? defaultTarget(r.column.id);
    }
    setError('');
    setSaving(true);
    const ok = await actions.updateColumns(project.id, columns, moves);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Dialog
      title="Columns"
      description={`These are the stages issues move through in ${project.name}. Order them left to right the way work flows.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="columns-form" className="btn btn-primary" disabled={saving}>
            Save columns
          </button>
        </>
      }
    >
      <form id="columns-form" onSubmit={submit} noValidate className="form-stack">
        <ol className="columns-list">
          {rows.map((r, index) => {
            const c = r.column;
            const n = counts.get(c.id) ?? 0;
            const position = rows.slice(0, index).filter((x) => !x.removed).length;
            const keptIndex = kept.findIndex((k) => k.column.id === c.id);
            if (r.removed) {
              const targets = kept.map((k) => k.column);
              return (
                <li key={c.id} className="columns-row is-removed">
                  <p className="columns-removed-text">
                    <strong className="wrap-anywhere">{c.name || 'This column'}</strong> will be removed.
                  </p>
                  {n > 0 && (
                    <label className="columns-move">
                      Move its {n} {n === 1 ? 'issue' : 'issues'} to
                      <select
                        className="input input-sm"
                        value={moveTo[c.id] ?? defaultTarget(c.id)}
                        onChange={(e) => setMoveTo({ ...moveTo, [c.id]: e.target.value })}
                      >
                        {targets.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name || 'Untitled column'}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => setRows((rs) => rs.map((x) => (x.column.id === c.id ? { ...x, removed: false } : x)))}>
                    Keep column
                  </button>
                </li>
              );
            }
            return (
              <li key={c.id} className="columns-row">
                <StatusIcon kind={c.kind} size={18} />
                <div className="columns-fields">
                  <label className="visually-hidden" htmlFor={`col-name-${c.id}`}>
                    Name of column {position + 1}
                  </label>
                  <input
                    id={`col-name-${c.id}`}
                    ref={(el) => {
                      inputs.current[c.id] = el;
                    }}
                    className="input"
                    value={c.name}
                    maxLength={LIMITS.columnName + 10}
                    placeholder="Column name"
                    onChange={(e) => patch(c.id, { name: e.target.value })}
                  />
                  <label className="visually-hidden" htmlFor={`col-kind-${c.id}`}>
                    What column {position + 1} is for
                  </label>
                  <select id={`col-kind-${c.id}`} className="input" value={c.kind} onChange={(e) => patch(c.id, { kind: e.target.value as ColumnKind })}>
                    {COLUMN_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_META[k].label}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">{KIND_META[c.kind].hint}</p>
                </div>
                <div className="columns-actions">
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(index, -1)} disabled={keptIndex <= 0} aria-label={`Move ${c.name || 'column'} left`}>
                    <Icon name="up" size={16} />
                  </button>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(index, 1)} disabled={keptIndex === kept.length - 1} aria-label={`Move ${c.name || 'column'} right`}>
                    <Icon name="down" size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => remove(c.id)}
                    disabled={kept.length <= 1}
                    aria-label={`Remove ${c.name || 'column'}${n ? `, which holds ${n} ${n === 1 ? 'issue' : 'issues'}` : ''}`}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {kept.length < LIMITS.maxColumns && (
          <button type="button" className="btn btn-block" onClick={add}>
            <Icon name="plus" size={16} /> Add a column
          </button>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
