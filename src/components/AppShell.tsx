import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom';
import { useStore } from '../state/store';
import { Brand } from './Brand';
import { ProjectDialog } from './ProjectDialog';
import { Avatar } from './ui/Badges';
import { Dialog } from './ui/Dialog';
import { Icon } from './ui/Icon';

function SidebarNav({ onNavigate, onNewProject }: { onNavigate?: () => void; onNewProject: () => void }) {
  const { data, currentUser } = useStore();
  const active = data.projects.filter((p) => !p.archivedAt);
  const openCounts = new Map<string, number>();
  for (const i of data.issues) if (i.status !== 'done') openCounts.set(i.projectId, (openCounts.get(i.projectId) ?? 0) + 1);

  return (
    <nav className="sidebar-nav" aria-label="Projects">
      <NavLink to="/" end className="nav-link" onClick={onNavigate}>
        <Icon name="home" size={18} /> All projects
      </NavLink>
      <h2 className="nav-heading">Projects</h2>
      <ul className="nav-list">
        {active.map((p) => (
          <li key={p.id}>
            <NavLink to={`/p/${p.id}`} className="nav-link" onClick={onNavigate}>
              <span className="project-dot" style={{ background: p.color }} aria-hidden="true" />
              <span className="nav-label">{p.name}</span>
              <span className="nav-count" aria-label={`${openCounts.get(p.id) ?? 0} open issues`}>
                {openCounts.get(p.id) ?? 0}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="nav-empty">No active projects yet.</p>}
      <button
        type="button"
        className="nav-link nav-add"
        onClick={() => {
          onNavigate?.();
          onNewProject();
        }}
      >
        <Icon name="plus" size={18} /> New project
      </button>
      <div className="sidebar-user">
        <Avatar user={currentUser} size={28} />
        <span>
          <strong>{currentUser.name}</strong>
          <small>Demo workspace (saved in this browser)</small>
        </span>
      </div>
    </nav>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const projectMatch = useMatch('/p/:projectId/*');
  const mainRef = useRef<HTMLElement>(null);
  const [switcher, setSwitcher] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data } = useStore();

  const projectId = projectMatch?.params.projectId;
  const project = projectId ? data.projects.find((p) => p.id === projectId) : undefined;
  const seg = pathname.split('/')[3];
  const view = seg === 'board' || seg === 'list' ? seg : 'overview';

  return (
    <div className="shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          // Hash routing owns the URL hash, so move focus manually instead of following the link.
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>

      <aside className="sidebar">
        <Link to="/" className="sidebar-brand" aria-label="Plumbline home">
          <Brand />
        </Link>
        <SidebarNav onNewProject={() => setCreating(true)} />
      </aside>

      <header className="topbar">
        <Link to="/" aria-label="Plumbline home">
          <Brand />
        </Link>
        <button type="button" className="btn btn-sm topbar-switch" onClick={() => setSwitcher(true)} aria-haspopup="dialog">
          {project ? (
            <>
              <span className="project-dot" style={{ background: project.color }} aria-hidden="true" />
              <span className="topbar-project">{project.name}</span>
            </>
          ) : (
            <>
              <Icon name="folder" size={16} /> Projects
            </>
          )}
          <Icon name="chevron-down" size={14} />
        </button>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Primary">
        {project ? (
          <>
            <NavLink to={`/p/${project.id}`} end className={() => `tab${view === 'overview' ? ' is-active' : ''}`} aria-current={view === 'overview' ? 'page' : undefined}>
              <Icon name="overview" /> <span>Overview</span>
            </NavLink>
            <NavLink to={`/p/${project.id}/board`} className={() => `tab${view === 'board' ? ' is-active' : ''}`} aria-current={view === 'board' ? 'page' : undefined}>
              <Icon name="board" /> <span>Board</span>
            </NavLink>
            <NavLink to={`/p/${project.id}/list`} className={() => `tab${view === 'list' ? ' is-active' : ''}`} aria-current={view === 'list' ? 'page' : undefined}>
              <Icon name="list" /> <span>List</span>
            </NavLink>
            {!project.archivedAt && (
              <Link to={`/p/${project.id}/${view}?new=todo`} className="tab tab-new">
                <Icon name="plus" /> <span>New issue</span>
              </Link>
            )}
          </>
        ) : (
          <>
            <NavLink to="/" end className="tab">
              <Icon name="home" /> <span>Projects</span>
            </NavLink>
            <button type="button" className="tab tab-new" onClick={() => setCreating(true)}>
              <Icon name="plus" /> <span>New project</span>
            </button>
          </>
        )}
      </nav>

      {switcher && (
        <Dialog variant="sheet" title="Switch project" onClose={() => setSwitcher(false)}>
          <SidebarNav onNavigate={() => setSwitcher(false)} onNewProject={() => setCreating(true)} />
        </Dialog>
      )}
      {creating && <ProjectDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
