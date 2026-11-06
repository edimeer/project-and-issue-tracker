import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Board } from '../components/Board';
import { ColumnsDialog } from '../components/ColumnsDialog';
import { FilterBar } from '../components/FilterBar';
import { IssueDialog } from '../components/IssueDialog';
import { IssueList } from '../components/IssueList';
import { Overview } from '../components/Overview';
import { ProjectDialog } from '../components/ProjectDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Menu } from '../components/ui/Menu';
import { doneIds, firstColumnId } from '../domain/columns';
import { applyFilters, countActiveFilters, emptyFilters, issueRef, sortIssues } from '../domain/filters';
import type { GroupBy, IssueFilters, SortField, SortState } from '../domain/filters';
import type { Issue, Status } from '../domain/types';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToday } from '../hooks/useToday';
import { useStore } from '../state/store';

const VIEWS = ['overview', 'board', 'list'] as const;
type View = (typeof VIEWS)[number];

export function ProjectPage() {
  const { projectId = '' } = useParams();
  // Keyed by project so filters reset when you switch projects.
  return <ProjectScreen key={projectId} projectId={projectId} />;
}

function ProjectScreen({ projectId }: { projectId: string }) {
  const { view: viewParam } = useParams();
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? '') ? (viewParam as View) : 'overview';
  const { data, actions, usersById, labelsById } = useStore();
  const today = useToday();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const project = data.projects.find((p) => p.id === projectId);
  useDocumentTitle(project ? `${project.name} - ${view}` : 'Project not found');

  const [filters, setFilters] = useState<IssueFilters>(emptyFilters);
  const [sort, setSort] = useState<SortState>({ field: 'updated', dir: 'desc' });
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editing, setEditing] = useState(false);
  const [editingColumns, setEditingColumns] = useState<null | 'edit' | 'add'>(null);
  const [confirm, setConfirm] = useState<'archive' | 'delete-project' | null>(null);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);

  const projectIssues = useMemo(() => data.issues.filter((i) => i.projectId === projectId), [data.issues, projectId]);
  const columns = project?.columns;
  const ctx = useMemo(
    () => ({ today, projectKey: project?.key ?? '', columns: columns ?? [], doneIds: doneIds(columns ?? []), usersById, labelsById }),
    [today, project?.key, columns, usersById, labelsById],
  );
  const filtered = useMemo(() => applyFilters(projectIssues, filters, ctx), [projectIssues, filters, ctx]);
  const sorted = useMemo(() => sortIssues(filtered, sort, columns ?? []), [filtered, sort, columns]);

  const openIssueId = params.get('issue');
  const newStatusParam = params.get('new');
  const creating = newStatusParam !== null;
  const newStatus: Status = project && newStatusParam && project.columns.some((c) => c.id === newStatusParam) ? newStatusParam : project ? firstColumnId(project.columns) : 'todo';

  const closeIssue = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('issue');
        next.delete('new');
        return next;
      },
      { replace: false },
    );
  }, [setParams]);
  const openIssue = useCallback((issue: Issue) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.delete('new');
    next.set('issue', issue.id);
    return next;
  }), [setParams]);
  const startCreate = useCallback((status: Status = 'todo') => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.delete('issue');
    next.set('new', status);
    return next;
  }), [setParams]);

  const onSortField = useCallback((field: SortField) => {
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'title' || field === 'status' || field === 'due' || field === 'number' ? 'asc' : 'desc' }));
  }, []);

  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon="folder"
          title="Project not found"
          action={
            <Link to="/" className="btn btn-primary">
              Back to all projects
            </Link>
          }
        >
          It may have been deleted. Check the projects list for what is available.
        </EmptyState>
      </div>
    );
  }

  const readOnly = !!project.archivedAt;
  const activeFilters = countActiveFilters(filters) > 0;
  const base = `/p/${project.id}`;
  const issueNode = (creating || openIssueId) && (
    <IssueDialog
      key={openIssueId ?? `new-${newStatus}`}
      project={project}
      issueId={openIssueId ?? undefined}
      initialStatus={newStatus}
      onClose={closeIssue}
    />
  );

  const viewProps = {
    project,
    ctx,
    readOnly,
    filtered: activeFilters && projectIssues.length > 0,
    onOpen: openIssue,
    onDelete: setIssueToDelete,
    onCreate: startCreate,
    onClearFilters: () => setFilters(emptyFilters),
    onEditColumns: () => setEditingColumns('add'),
  };

  return (
    <div className="page project-page" style={{ ['--project' as string]: project.color }}>
      <header className="project-header">
        <div className="project-header-main">
          <p className="crumb">
            <Link to="/">Projects</Link>
            <Icon name="chevron-right" size={14} />
            <span className="project-key">{project.key}</span>
          </p>
          <h1 className="page-title wrap-anywhere">{project.name}</h1>
          {project.description && <p className="page-sub wrap-anywhere">{project.description}</p>}
        </div>
        <div className="project-actions">
          {!readOnly && (
            <button type="button" className="btn btn-primary" onClick={() => startCreate()}>
              <Icon name="plus" size={16} /> New issue
            </button>
          )}
          <Menu
            label="Project actions"
            className="btn btn-icon"
            entries={[
              { kind: 'item', label: 'Rename or edit project', icon: 'pencil', disabled: readOnly, onSelect: () => setEditing(true) },
              { kind: 'item', label: 'Edit columns', icon: 'columns', disabled: readOnly, onSelect: () => setEditingColumns('edit') },
              readOnly
                ? { kind: 'item', label: 'Restore project', icon: 'restore', onSelect: () => void actions.restoreProject(project.id) }
                : { kind: 'item', label: 'Archive project', icon: 'archive', onSelect: () => setConfirm('archive') },
              { kind: 'separator' },
              { kind: 'item', label: 'Delete project', icon: 'trash', danger: true, onSelect: () => setConfirm('delete-project') },
            ]}
          />
        </div>
      </header>

      {readOnly && (
        <div className="banner" role="status">
          <Icon name="archive" size={18} />
          <p>This project is archived and read-only.</p>
          <button type="button" className="btn btn-sm" onClick={() => void actions.restoreProject(project.id)}>
            Restore
          </button>
        </div>
      )}

      <nav className="view-tabs" aria-label="Project views">
        <NavLink to={base} end className={() => `view-tab${view === 'overview' ? ' is-active' : ''}`} aria-current={view === 'overview' ? 'page' : undefined}>
          <Icon name="overview" size={16} /> Overview
        </NavLink>
        <NavLink to={`${base}/board`} className={() => `view-tab${view === 'board' ? ' is-active' : ''}`} aria-current={view === 'board' ? 'page' : undefined}>
          <Icon name="board" size={16} /> Board
        </NavLink>
        <NavLink to={`${base}/list`} className={() => `view-tab${view === 'list' ? ' is-active' : ''}`} aria-current={view === 'list' ? 'page' : undefined}>
          <Icon name="list" size={16} /> List
        </NavLink>
      </nav>

      {view === 'overview' && (
        <Overview project={project} issues={projectIssues} today={today} readOnly={readOnly} onOpen={openIssue} onCreate={() => startCreate()} />
      )}

      {view !== 'overview' && projectIssues.length === 0 && (
        <EmptyState
          icon="board"
          title="No issues yet"
          action={
            !readOnly && (
              <button type="button" className="btn btn-primary" onClick={() => startCreate()}>
                <Icon name="plus" size={16} /> Create the first issue
              </button>
            )
          }
        >
          Add an issue to see it on the board and in the list.
        </EmptyState>
      )}

      {view !== 'overview' && projectIssues.length > 0 && (
        <>
          <FilterBar
            filters={filters}
            onChange={setFilters}
            columns={project.columns}
            shown={filtered.length}
            total={projectIssues.length}
            listControls={
              view === 'list'
                ? {
                    sort,
                    groupBy,
                    onSortField,
                    onToggleDir: () => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' })),
                    onGroupBy: setGroupBy,
                  }
                : undefined
            }
          />
          {view === 'board' ? (
            <Board {...viewProps} issues={filtered} />
          ) : (
            <IssueList {...viewProps} issues={sorted} groupBy={groupBy} sort={sort} onSort={onSortField} />
          )}
        </>
      )}

      {issueNode}
      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
      {editingColumns && <ColumnsDialog project={project} startWithNew={editingColumns === 'add'} onClose={() => setEditingColumns(null)} />}

      {confirm === 'archive' && (
        <ConfirmDialog
          title="Archive this project?"
          confirmLabel="Archive project"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await actions.archiveProject(project.id);
            setConfirm(null);
          }}
        >
          <p>
            <strong className="wrap-anywhere">{project.name}</strong> will become read-only and move out of the sidebar. Nothing is deleted, and you can restore it any time from the Projects page.
          </p>
        </ConfirmDialog>
      )}
      {confirm === 'delete-project' && (
        <ConfirmDialog
          title="Delete this project forever?"
          confirmLabel="Delete project"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const ok = await actions.deleteProject(project.id);
            if (ok) navigate('/');
            else setConfirm(null);
          }}
        >
          <p>
            <strong className="wrap-anywhere">{project.name}</strong>, its {projectIssues.length} {projectIssues.length === 1 ? 'issue' : 'issues'} and its activity will be permanently deleted. If you only want it out of the way, archive it instead.
          </p>
        </ConfirmDialog>
      )}
      {issueToDelete && (
        <ConfirmDialog
          title="Delete this issue?"
          confirmLabel="Delete issue"
          danger
          onCancel={() => setIssueToDelete(null)}
          onConfirm={async () => {
            await actions.deleteIssue(issueToDelete.id);
            setIssueToDelete(null);
          }}
        >
          <p>
            <strong className="wrap-anywhere">
              {issueRef(project, issueToDelete)}: {issueToDelete.title}
            </strong>{' '}
            will be permanently deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
