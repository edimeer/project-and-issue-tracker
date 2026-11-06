# Plumbline

A project and issue tracker for small teams, built with React, TypeScript and Vite.
Everything runs in the browser and saves to local storage, so it works with no server.
The data layer is isolated behind one interface so a Ruby on Rails API can replace it later.

## Features

- Projects: create, rename or edit, archive and restore, delete (with confirmation).
- Issues: title, description, status, priority, assignee, labels and due date. Create, view, edit and delete.
- Columns: every project has its own columns. New projects start with Backlog, Todo, In Progress, In Review and Done, and you can add, rename, reorder and remove them. Priorities: Low, Medium, High, Urgent.
- Board view with drag and drop, and a list view with sorting and grouping.
- Search and filters by text, status, priority, assignee, label and due date.
- Project overview: counts by status, progress, items that need attention, upcoming due dates, recent activity.
- Starter projects and issues on first launch, so the workspace is not empty. You can change, add and remove all of it.
- Light and dark themes (follows the system setting), responsive from phone to desktop.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

Other commands:

```bash
npm run build       # typecheck, then build the production site into dist/
npm run preview     # serve the production build locally
npm run lint        # ESLint
npm run typecheck   # TypeScript, no output files
npm test            # unit tests (Vitest)
```

## Deploying to GitHub Pages

The app uses hash-based URLs (`#/p/...`), so it needs no server rewrite rules and works under any sub-path.

**Base path.** When the site is served from `https://<user>.github.io/<repo>/`, the build must know the `/<repo>/` prefix.
It reads it from the `VITE_BASE_PATH` environment variable (see [vite.config.ts](vite.config.ts)).
If you leave it unset, it defaults to `./` (relative paths), which also works in most places.
The value must start and end with a slash, for example `/my-repo/`. Use `/` for a custom domain at the root.

**Using the included workflow** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):

1. Push the project to a GitHub repository whose default branch is `main`.
2. In the repository, open Settings, then Pages, and set Source to "GitHub Actions".
3. Push to `main`. The workflow lints, typechecks, tests, builds and publishes.
   It sets `VITE_BASE_PATH` from the repository name automatically.
4. To use a different path (for example a custom domain), add a repository variable named `VITE_BASE_PATH`
   under Settings, Secrets and variables, Actions, Variables.

**Deploying by hand:**

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build
```

Then publish the contents of `dist/` with any static host.

## Using the app

- **Projects page**: pick a project, create one with "New project", and restore or delete archived ones.
- **Create an issue**: "New issue" in the project header (on a phone, the "New issue" tab at the bottom), or the plus button on a board column to pre-select that status.
- **Edit an issue**: click its title. The editor opens as a side panel on larger screens and full screen on phones. Closing with unsaved edits asks first.
- **Move an issue**: drag a card to another column, or open the card's actions menu (the three dots) and choose "Move to". In the list view, click the column badge.
- **Change columns**: use "Add column" at the end of the board, or "Edit columns" in the project menu. Name each column and say what it is for (Waiting, Ready, Working, Checking, Finished). That controls its icon and color, and issues in a Finished column stop counting as overdue. Reorder with the arrow buttons. When you remove a column that holds issues, you choose which column takes them.
- **Board on phones**: shows one status at a time using tabs above the cards. Use the actions menu to move cards.
- **Filter and search**: type in the search box, or open "Filters" for status, priority, assignee, labels (any of) and due date. Active filters show as removable chips.
- **List view**: choose Group (none, status, priority, assignee, due date) and Sort, or click a column heading.
- **Archive a project**: project actions menu (the three dots in the project header). Archived projects are read-only until restored.

### Keyboard and screen reader support

- Everything is reachable with Tab and Shift+Tab, with a visible focus ring. A "Skip to content" link is the first stop.
- **Drag and drop with the keyboard**: focus the grip button on a card, press Space or Enter to pick up,
  Left and Right arrows to change column, Space or Enter to drop, Escape to cancel.
  Screen readers announce each step through a live region. Focus returns to the card after it lands.
- Menus open with Enter or Space, move with Up and Down (Home and End jump), and close with Escape.
- Dialogs are native `<dialog>` elements: focus is trapped inside, Escape closes them, and focus returns to what opened them.
- Status and priority always have a text label and a distinct icon shape, not only a colour.
- Form errors appear next to the field, are linked with `aria-describedby`, and focus moves to the first invalid field.
- Saved changes and failures are announced through status messages.
- Animations are reduced when the system asks for it.

## Project structure

```
src/
  domain/        Typed data model, constants, date helpers, validation, filter/sort/group logic (pure, tested)
  data/          Repository interface, localStorage implementation, seed data
  state/         React store: loads a snapshot, calls the repository, updates the UI
  components/    Feature components (board, list, filters, dialogs, overview, shell)
    ui/          Reusable pieces: Dialog, Menu, Field, Badges, Icon, Toasts, EmptyState
  pages/         Route-level screens
  hooks/         Small hooks (media query, today's date, document title)
  styles/        Design tokens and all CSS
docs/api.md      Rails API contract
```

## Data persistence

All data is one JSON document in `localStorage`, under the key `plumbline:v1:<base path>`.
Including the base path matters on GitHub Pages: every project site under the same `github.io` account shares an origin,
and the key keeps two apps from reading each other's data.

- Seeded on first launch with starter projects and issues. Their due dates are relative to the day of first launch.
- Every change is written immediately. If a write fails (storage full or disabled) you see an error message and the old data is kept.
- If the stored data cannot be read, the app falls back to the starter data and keeps a copy of the unreadable data under `<key>:corrupt-backup`.
- Data saved by earlier versions (without per-project columns) is upgraded on load.
- Changes made in another tab are picked up automatically.
- Data lives only in this browser. Clearing site data removes it.

## Where the Rails API plugs in

The UI never touches `localStorage`. It talks to the `Repository` interface in
[src/data/repository.ts](src/data/repository.ts). [src/data/index.ts](src/data/index.ts) is the single place that picks the implementation.
To move to Rails, write an `ApiRepository` that implements the same interface with `fetch` calls and return it from `createRepository()`.

The endpoints, JSON shapes, validation rules and error format a Rails backend should provide are in [docs/api.md](docs/api.md).

## Current limitations

- Single user, single browser. The signed-in user is fixed, and assignees are the people built into the starter data.
- No real-time sync between people, and no authentication.
- Labels can be added in the issue editor but not renamed or deleted.
- Cards inside a board column are ordered by priority, so you cannot drag to reorder within a column.
- A project can have up to 12 columns.
- Activity keeps the latest 500 events.
