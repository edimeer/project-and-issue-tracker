import { useState } from 'react';
import { PRIORITY_META } from '../domain/constants';
import { GROUP_LABELS, SORT_LABELS, UNASSIGNED, countActiveFilters, emptyFilters } from '../domain/filters';
import type { DueFilter, GroupBy, IssueFilters, SortField, SortState } from '../domain/filters';
import { PRIORITIES } from '../domain/types';
import type { Column } from '../domain/types';
import { useStore } from '../state/store';
import { Avatar, PriorityIcon, StatusIcon } from './ui/Badges';
import { Dialog } from './ui/Dialog';
import { Icon } from './ui/Icon';

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due in the next 7 days' },
  { value: 'none', label: 'No due date' },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

interface Props {
  filters: IssueFilters;
  onChange: (next: IssueFilters) => void;
  columns: Column[];
  shown: number;
  total: number;
  /** Present only in the list view. */
  listControls?: {
    sort: SortState;
    groupBy: GroupBy;
    onSortField: (f: SortField) => void;
    onToggleDir: () => void;
    onGroupBy: (g: GroupBy) => void;
  };
}

export function FilterBar({ filters, onChange, columns, shown, total, listControls }: Props) {
  const { data, usersById, labelsById } = useStore();
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(filters) - (filters.query.trim() ? 1 : 0);

  const chips: { key: string; text: string; remove: () => void }[] = [
    ...filters.statuses.map((s) => ({ key: `s-${s}`, text: `Column: ${columns.find((c) => c.id === s)?.name ?? 'Unknown'}`, remove: () => onChange({ ...filters, statuses: toggle(filters.statuses, s) }) })),
    ...filters.priorities.map((p) => ({ key: `p-${p}`, text: `Priority: ${PRIORITY_META[p].label}`, remove: () => onChange({ ...filters, priorities: toggle(filters.priorities, p) }) })),
    ...filters.assignees.map((a) => ({
      key: `a-${a}`,
      text: `Assignee: ${a === UNASSIGNED ? 'Unassigned' : (usersById.get(a)?.name ?? 'Unknown')}`,
      remove: () => onChange({ ...filters, assignees: toggle(filters.assignees, a) }),
    })),
    ...filters.labels.map((l) => ({ key: `l-${l}`, text: `Label: ${labelsById.get(l)?.name ?? 'Unknown'}`, remove: () => onChange({ ...filters, labels: toggle(filters.labels, l) }) })),
    ...(filters.due !== 'any' ? [{ key: 'due', text: `Due: ${DUE_OPTIONS.find((o) => o.value === filters.due)?.label}`, remove: () => onChange({ ...filters, due: 'any' as DueFilter }) }] : []),
  ];

  return (
    <div className="filterbar">
      <div className="toolbar" role="search">
        <div className="search">
          <Icon name="search" size={18} />
          <label htmlFor="issue-search" className="visually-hidden">
            Search issues
          </label>
          <input
            id="issue-search"
            type="search"
            className="search-input"
            placeholder="Search title, description, ID, label, person"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
          />
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="filter" size={16} />
          Filters
          {active > 0 && <span className="count count-on">{active}</span>}
        </button>
        {listControls && (
          <>
            <div className="select-group">
              <label htmlFor="group-by">Group</label>
              <select id="group-by" className="input input-sm" value={listControls.groupBy} onChange={(e) => listControls.onGroupBy(e.target.value as GroupBy)}>
                {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-group">
              <label htmlFor="sort-by">Sort</label>
              <select id="sort-by" className="input input-sm" value={listControls.sort.field} onChange={(e) => listControls.onSortField(e.target.value as SortField)}>
                {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
                  <option key={f} value={f}>
                    {SORT_LABELS[f]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn"
                onClick={listControls.onToggleDir}
                aria-label={`Sort direction: ${listControls.sort.dir === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`}
              >
                <Icon name={listControls.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {(chips.length > 0 || countActiveFilters(filters) > 0) && (
        <div className="chips-row">
          <ul className="chips" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" className="chip" onClick={c.remove} aria-label={`Remove filter ${c.text}`}>
                  {c.text}
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="link-btn" onClick={() => onChange(emptyFilters)}>
            Clear all
          </button>
        </div>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        Showing {shown} of {total} issues.
      </p>

      {open && (
        <Dialog
          variant="drawer"
          title="Filters"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => onChange(emptyFilters)} disabled={countActiveFilters(filters) === 0}>
                Clear all
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)} data-autofocus="">
                Show {shown} {shown === 1 ? 'issue' : 'issues'}
              </button>
            </>
          }
        >
          <div className="form-stack">
            <fieldset className="fieldset">
              <legend className="field-label">Column</legend>
              <div className="check-list">
                {columns.map((c) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" checked={filters.statuses.includes(c.id)} onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, c.id) })} />
                    <StatusIcon kind={c.kind} /> {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="field-label">Priority</legend>
              <div className="check-list">
                {PRIORITIES.map((p) => (
                  <label key={p} className="check">
                    <input type="checkbox" checked={filters.priorities.includes(p)} onChange={() => onChange({ ...filters, priorities: toggle(filters.priorities, p) })} />
                    <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="field-label">Assignee</legend>
              <div className="check-list">
                {data.users.map((u) => (
                  <label key={u.id} className="check">
                    <input type="checkbox" checked={filters.assignees.includes(u.id)} onChange={() => onChange({ ...filters, assignees: toggle(filters.assignees, u.id) })} />
                    <Avatar user={u} size={20} /> {u.name}
                  </label>
                ))}
                <label className="check">
                  <input type="checkbox" checked={filters.assignees.includes(UNASSIGNED)} onChange={() => onChange({ ...filters, assignees: toggle(filters.assignees, UNASSIGNED) })} />
                  <span className="avatar-blank" aria-hidden="true" /> Unassigned
                </label>
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="field-label">Labels (any of)</legend>
              <div className="check-list">
                {data.labels.map((l) => (
                  <label key={l.id} className="check">
                    <input type="checkbox" checked={filters.labels.includes(l.id)} onChange={() => onChange({ ...filters, labels: toggle(filters.labels, l.id) })} />
                    <span className="label-dot" style={{ ['--label' as string]: l.color }} aria-hidden="true" /> {l.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="field-label">Due date</legend>
              <div className="check-list">
                {DUE_OPTIONS.map((o) => (
                  <label key={o.value} className="check">
                    <input type="radio" name="due-filter" checked={filters.due === o.value} onChange={() => onChange({ ...filters, due: o.value })} />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Dialog>
      )}
    </div>
  );
}
