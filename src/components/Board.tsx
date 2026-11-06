import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, CollisionDetection, DragEndEvent, DragStartEvent, KeyboardCoordinateGetter } from '@dnd-kit/core';
import { PRIORITY_META } from '../domain/constants';
import { issueRef } from '../domain/filters';
import type { Column, ID, Issue } from '../domain/types';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useStore } from '../state/store';
import { IssueCard } from './IssueCard';
import type { IssueViewProps } from './viewTypes';
import { StatusIcon } from './ui/Badges';
import { EmptyState } from './ui/EmptyState';
import { Icon } from './ui/Icon';

const PAGE = 40;

/** Within a column: most urgent first, then newest. */
function orderForBoard(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || b.number - a.number,
  );
}

/** Arrow Left/Right while holding a card jumps to the neighbouring column. */
function makeColumnGetter(columnIds: ID[]): KeyboardCoordinateGetter {
  return (event, { context: { droppableRects, collisionRect }, currentCoordinates }) => {
    if (!collisionRect) return undefined;
    if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
    event.preventDefault();
    const columns = columnIds.map((id) => ({ id, rect: droppableRects.get(id) })).filter((c) => !!c.rect);
    if (!columns.length) return undefined;
    const centerX = collisionRect.left + collisionRect.width / 2;
    let current = 0;
    let best = Infinity;
    columns.forEach((c, i) => {
      const r = c.rect as NonNullable<typeof c.rect>;
      const d = Math.abs(r.left + r.width / 2 - centerX);
      if (d < best) {
        best = d;
        current = i;
      }
    });
    const next = Math.max(0, Math.min(columns.length - 1, current + (event.code === 'ArrowRight' ? 1 : -1)));
    const target = columns[next].rect as NonNullable<(typeof columns)[number]['rect']>;
    return {
      x: currentCoordinates.x + (target.left + target.width / 2 - centerX),
      y: currentCoordinates.y + (target.top + 12 - collisionRect.top),
    };
  };
}

const collision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : rectIntersection(args);
};

export function Board(props: IssueViewProps) {
  const narrow = useMediaQuery('(max-width: 719px)');
  const columns = props.project.columns;
  const byColumn = useMemo(() => {
    const map = new Map<ID, Issue[]>(columns.map((c) => [c.id, []]));
    for (const i of props.issues) map.get(i.status)?.push(i);
    for (const c of columns) map.set(c.id, orderForBoard(map.get(c.id) ?? []));
    return map;
  }, [props.issues, columns]);

  if (props.issues.length === 0 && props.filtered) {
    return (
      <EmptyState
        icon="filter"
        title="No issues match your filters"
        action={
          <button type="button" className="btn" onClick={props.onClearFilters}>
            Clear filters
          </button>
        }
      >
        Try a different search or remove some filters.
      </EmptyState>
    );
  }

  return narrow ? <NarrowBoard {...props} byColumn={byColumn} /> : <WideBoard {...props} byColumn={byColumn} />;
}

type WithGroups = IssueViewProps & { byColumn: Map<ID, Issue[]> };

/* ---------- Phones: one column at a time ---------- */

function NarrowBoard({ byColumn, project, ctx, readOnly, onOpen, onDelete, onCreate, onEditColumns }: WithGroups) {
  const columns = project.columns;
  const [chosen, setChosen] = useState<ID | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeId = columns.some((c) => c.id === chosen) ? (chosen as ID) : (columns.find((c) => c.kind === 'todo') ?? columns[0]).id;
  const active = columns.find((c) => c.id === activeId) as Column;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = columns.findIndex((c) => c.id === activeId);
    let n = i;
    if (e.key === 'ArrowRight') n = Math.min(columns.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') n = Math.max(0, i - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = columns.length - 1;
    else return;
    e.preventDefault();
    setChosen(columns[n].id);
    tabRefs.current[columns[n].id]?.focus();
  }

  const issues = byColumn.get(activeId) ?? [];
  return (
    <div className="board-narrow">
      <div className="status-tabs" role="tablist" aria-label="Columns" onKeyDown={onKeyDown}>
        {columns.map((c) => (
          <button
            key={c.id}
            ref={(el) => {
              tabRefs.current[c.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${c.id}`}
            aria-selected={activeId === c.id}
            aria-controls="status-panel"
            tabIndex={activeId === c.id ? 0 : -1}
            className={`status-tab status-${c.kind}`}
            onClick={() => setChosen(c.id)}
          >
            <StatusIcon kind={c.kind} size={14} />
            <span>{c.name}</span>
            <span className="count">{byColumn.get(c.id)?.length ?? 0}</span>
          </button>
        ))}
      </div>
      <div id="status-panel" role="tabpanel" aria-labelledby={`tab-${activeId}`} className="board-narrow-panel">
        {issues.length === 0 ? (
          <p className="column-empty">No issues in {active.name}.</p>
        ) : (
          <Cards issues={issues} {...{ project, ctx, readOnly, onOpen, onDelete }} />
        )}
        {!readOnly && (
          <>
            <button type="button" className="btn btn-block" onClick={() => onCreate(activeId)}>
              <Icon name="plus" size={16} /> Add issue to {active.name}
            </button>
            <button type="button" className="btn btn-block btn-quiet" onClick={onEditColumns}>
              <Icon name="columns" size={16} /> Add or edit columns
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Cards({ issues, project, ctx, readOnly, onOpen, onDelete }: Pick<IssueViewProps, 'issues' | 'project' | 'ctx' | 'readOnly' | 'onOpen' | 'onDelete'>) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      {issues.slice(0, limit).map((issue) => (
        <IssueCard key={issue.id} {...{ issue, project, ctx, readOnly, onOpen, onDelete }} />
      ))}
      {issues.length > limit && (
        <button type="button" className="btn btn-block" onClick={() => setLimit(limit + PAGE)}>
          Show {Math.min(PAGE, issues.length - limit)} more ({issues.length - limit} hidden)
        </button>
      )}
    </>
  );
}

/* ---------- Tablet and desktop: columns with drag and drop ---------- */

function WideBoard({ byColumn, project, ctx, readOnly, onOpen, onDelete, onCreate, onEditColumns, issues }: WithGroups) {
  const { actions } = useStore();
  const columns = project.columns;
  const [activeId, setActiveId] = useState<string | null>(null);
  // After a move the card remounts in its new column; this puts keyboard focus back on it.
  const [refocus, setRefocus] = useState<{ id: string; status: ID } | null>(null);
  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);
  const activeIssue = activeId ? byId.get(activeId) : undefined;
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const getter = useMemo(() => makeColumnGetter(columnIds), [columnIds]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: getter }),
  );

  const label = (id: string | number | undefined) => {
    const i = id ? byId.get(String(id)) : undefined;
    return i ? `${issueRef(project, i)} ${i.title}` : 'Issue';
  };
  const columnName = (id: string | number | undefined) => columns.find((c) => c.id === id)?.name ?? 'a column';

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}. It is in ${columnName(byId.get(String(active.id))?.status)}. Use left and right arrow keys to choose a column.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is over ${columnName(over.id)}.` : `${label(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `${label(active.id)} was dropped in ${columnName(over.id)}.` : `${label(active.id)} was dropped. No change.`),
    onDragCancel: ({ active }) => `Move cancelled. ${label(active.id)} stayed where it was.`,
  };

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const issue = byId.get(String(e.active.id));
    const target = e.over ? String(e.over.id) : undefined;
    if (issue && target && columnIds.includes(target) && issue.status !== target) {
      setRefocus({ id: issue.id, status: target });
      void actions.moveIssue(issue.id, target).then((ok) => {
        if (!ok) setRefocus(null);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To pick up this issue, press space or enter. Use the left and right arrow keys to move it between columns, then press space or enter to drop it. Press escape to cancel. You can also use the actions menu on the card to change its column.',
        },
      }}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="board-columns" style={{ ['--cols' as string]: columns.length }}>
        {columns.map((c) => (
          <ColumnView key={c.id} column={c} issues={byColumn.get(c.id) ?? []} {...{ project, ctx, readOnly, onOpen, onDelete, onCreate }} draggingId={activeId} refocus={refocus} onRefocused={() => setRefocus(null)} />
        ))}
        {!readOnly && (
          <div className="column column-add">
            <button type="button" className="add-column-btn" onClick={onEditColumns}>
              <Icon name="plus" size={18} />
              <span>Add column</span>
            </button>
          </div>
        )}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeIssue ? <IssueCard issue={activeIssue} {...{ project, ctx }} readOnly overlay onOpen={() => undefined} onDelete={() => undefined} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps extends Pick<IssueViewProps, 'project' | 'ctx' | 'readOnly' | 'onOpen' | 'onDelete' | 'onCreate'> {
  column: Column;
  issues: Issue[];
  draggingId: string | null;
  refocus: { id: string; status: ID } | null;
  onRefocused: () => void;
}

function ColumnView({ column, issues, project, ctx, readOnly, onOpen, onDelete, onCreate, draggingId, refocus, onRefocused }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: readOnly });
  const [limit, setLimit] = useState(PAGE);
  const headingId = `col-${column.id}`;
  return (
    <section
      ref={setNodeRef}
      className={`column status-${column.kind}${isOver && draggingId ? ' is-over' : ''}`}
      style={{ ['--n' as string]: issues.length }}
      aria-labelledby={headingId}
    >
      <span className="column-weight" aria-hidden="true" />
      <header className="column-header">
        <h2 id={headingId} className={`column-title status-${column.kind}`}>
          <StatusIcon kind={column.kind} />
          <span className="column-name">{column.name}</span>
        </h2>
        <span className="count" aria-label={`${issues.length} issues`}>
          {issues.length}
        </span>
        {!readOnly && (
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => onCreate(column.id)} aria-label={`Add issue to ${column.name}`}>
            <Icon name="plus" size={16} />
          </button>
        )}
      </header>
      <div className="column-body">
        {issues.length === 0 && <p className="column-empty">{readOnly ? 'Nothing here.' : 'Drop an issue here or add one.'}</p>}
        {issues.slice(0, limit).map((issue) => (
          <DraggableCard key={issue.id} {...{ issue, project, ctx, readOnly, onOpen, onDelete, refocus, onRefocused }} />
        ))}
        {issues.length > limit && (
          <button type="button" className="btn btn-block btn-sm" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, issues.length - limit)} more
          </button>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ refocus, onRefocused, ...props }: Pick<IssueViewProps, 'project' | 'ctx' | 'readOnly' | 'onOpen' | 'onDelete'> & { issue: Issue; refocus: { id: string; status: ID } | null; onRefocused: () => void }) {
  const handle = useRef<HTMLButtonElement | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: props.issue.id,
    disabled: props.readOnly,
  });
  const mustRefocus = refocus?.id === props.issue.id && refocus.status === props.issue.status;
  useEffect(() => {
    if (mustRefocus) {
      handle.current?.focus();
      onRefocused();
    }
  }, [mustRefocus, onRefocused]);
  return (
    <div ref={setNodeRef} className={`draggable${isDragging ? ' is-dragging' : ''}`} {...listeners}>
      <IssueCard
        {...props}
        dragHandle={
          <button
            type="button"
            ref={(el) => {
              handle.current = el;
              setActivatorNodeRef(el);
            }}
            className="icon-btn icon-btn-sm drag-handle"
            aria-label={`Move ${issueRef(props.project, props.issue)}. Press space to pick up, arrow keys to change column, space to drop.`}
            {...attributes}
          >
            <Icon name="grip" size={16} />
          </button>
        }
      />
    </div>
  );
}
