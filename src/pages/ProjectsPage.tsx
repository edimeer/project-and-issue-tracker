import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectDialog } from '../components/ProjectDialog';
import { Avatar, PriorityIcon } from '../components/ui/Badges';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { describeDue, formatDate } from '../domain/dates';
import { doneIds } from '../domain/columns';
import { isOverdue, issueRef } from '../domain/filters';
import type { Project } from '../domain/types';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToday } from '../hooks/useToday';
import { useStore } from '../state/store';

export function ProjectsPage() {
  useDocumentTitle('Projects');
  const { data, actions, currentUser } = useStore();
  const today = useToday();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, { total: number; done: number; overdue: number }>();
    const finished = new Map(data.projects.map((p) => [p.id, doneIds(p.columns)]));
    for (const p of data.projects) map.set(p.id, { total: 0, done: 0, overdue: 0 });
    for (const i of data.issues) {
      const s = map.get(i.projectId);
      const fin = finished.get(i.projectId);
      if (!s || !fin) continue;
      s.total += 1;
      if (fin.has(i.status)) s.done += 1;
      if (isOverdue(i, today, fin)) s.overdue += 1;
    }
    return map;
  }, [data.projects, data.issues, today]);

  const active = data.projects.filter((p) => !p.archivedAt);
  const archived = data.projects.filter((p) => p.archivedAt);
  const projectsById = new Map(data.projects.map((p) => [p.id, p]));
  const mine = data.issues
    .filter((i) => {
      const p = projectsById.get(i.projectId);
      return i.assigneeId === currentUser.id && !!p && !p.archivedAt && !doneIds(p.columns).has(i.status);
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .slice(0, 6);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">Pick up where you left off, or start something new.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New project
        </button>
      </header>

      {active.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No active projects"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> Create a project
            </button>
          }
        >
          Projects group related issues together. Create one to get started{archived.length ? ', or restore an archived project below' : ''}.
        </EmptyState>
      ) : (
        <ul className="project-grid">
          {active.map((p) => {
            const s = stats.get(p.id) ?? { total: 0, done: 0, overdue: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <li key={p.id}>
                <Link to={`/p/${p.id}`} className="project-card" style={{ ['--project' as string]: p.color }}>
                  <span className="project-card-top">
                    <span className="project-key">{p.key}</span>
                    {s.overdue > 0 && <span className="pill pill-danger">{s.overdue} overdue</span>}
                  </span>
                  <h2 className="project-card-name">{p.name}</h2>
                  <p className="project-card-desc">{p.description || 'No description yet.'}</p>
                  <span className="project-progress" role="img" aria-label={`${pct}% of issues done`}>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="project-card-stats">
                    {s.total - s.done} open of {s.total} issues - {pct}% done
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <section className="panel" aria-labelledby="mine">
          <h2 id="mine" className="panel-title">
            Assigned to you
          </h2>
          <ul className="mini-list">
            {mine.map((i) => {
              const p = projectsById.get(i.projectId);
              if (!p) return null;
              const due = i.dueDate ? describeDue(i.dueDate, today) : null;
              return (
                <li key={i.id} className="mini">
                  <PriorityIcon priority={i.priority} />
                  <div className="mini-main">
                    <Link to={`/p/${p.id}/board?issue=${i.id}`} className="row-title">
                      <span className="issue-ref">{issueRef(p, i)}</span> {i.title}
                    </Link>
                    <span className={`mini-meta${due?.tone === 'overdue' ? ' is-overdue' : ''}`}>
                      {p.name} - {due ? due.text : 'No due date'}
                    </span>
                  </div>
                  <Avatar user={currentUser} size={22} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived">
          <h2 id="archived" className="section-title">
            Archived ({archived.length})
          </h2>
          <ul className="archived-list">
            {archived.map((p) => (
              <li key={p.id} className="archived-item">
                <span className="project-dot" style={{ background: p.color }} aria-hidden="true" />
                <div className="archived-main">
                  <Link to={`/p/${p.id}`} className="archived-name">
                    {p.name}
                  </Link>
                  <small>
                    {p.key} - archived {p.archivedAt ? formatDate(p.archivedAt.slice(0, 10)) : ''}
                  </small>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => void actions.restoreProject(p.id)}>
                  <Icon name="restore" size={14} /> Restore
                </button>
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => setDeleting(p)}>
                  <Icon name="trash" size={14} /> Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}


      {creating && <ProjectDialog onClose={() => setCreating(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this project forever?"
          confirmLabel="Delete project"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await actions.deleteProject(deleting.id);
            setDeleting(null);
          }}
        >
          <p>
            <strong className="wrap-anywhere">{deleting.name}</strong> and all of its issues and activity will be permanently deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
