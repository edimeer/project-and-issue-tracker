import { useState } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/ui/EmptyState';
import { ToastProvider } from './components/ui/Toasts';
import { createRepository } from './data';
import { ProjectPage } from './pages/ProjectPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { StoreProvider } from './state/store';

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        icon="search"
        title="Page not found"
        action={
          <Link to="/" className="btn btn-primary">
            Go to projects
          </Link>
        }
      >
        That address does not match anything in Plumbline.
      </EmptyState>
    </div>
  );
}

export default function App() {
  const [repo] = useState(createRepository);
  return (
    // Hash routing: works on GitHub Pages sub-paths and any static host without rewrite rules.
    <HashRouter>
      <ToastProvider>
        <StoreProvider repo={repo}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<ProjectsPage />} />
              <Route path="p/:projectId" element={<ProjectPage />} />
              <Route path="p/:projectId/:view" element={<ProjectPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </StoreProvider>
      </ToastProvider>
    </HashRouter>
  );
}
