import { PRIORITY_META } from '../domain/constants';
import { PRIORITIES } from '../domain/types';
import type { Column, Issue } from '../domain/types';
import type { StoreActions } from '../state/store';
import { PriorityIcon, StatusIcon } from './ui/Badges';
import type { MenuEntry } from './ui/Menu';

interface Args {
  issue: Issue;
  columns: Column[];
  readOnly: boolean;
  actions: StoreActions;
  onOpen: (issue: Issue) => void;
  onDelete: (issue: Issue) => void;
}

/** The per-issue actions menu. This is also the menu-based, non-drag way to change status. */
export function buildIssueMenu({ issue, columns, readOnly, actions, onOpen, onDelete }: Args): MenuEntry[] {
  const entries: MenuEntry[] = [{ kind: 'item', label: readOnly ? 'View issue' : 'Open and edit', icon: 'pencil', onSelect: () => onOpen(issue) }];
  if (readOnly) return entries;
  entries.push({ kind: 'separator' }, { kind: 'heading', label: 'Move to' });
  for (const c of columns) {
    entries.push({
      kind: 'item',
      label: c.name,
      icon: <StatusIcon kind={c.kind} />,
      checked: issue.status === c.id,
      onSelect: () => void actions.moveIssue(issue.id, c.id),
    });
  }
  entries.push({ kind: 'separator' }, { kind: 'heading', label: 'Priority' });
  for (const p of PRIORITIES) {
    entries.push({
      kind: 'item',
      label: PRIORITY_META[p].label,
      icon: <PriorityIcon priority={p} />,
      checked: issue.priority === p,
      onSelect: () => void actions.updateIssue(issue.id, { priority: p }),
    });
  }
  entries.push({ kind: 'separator' }, { kind: 'item', label: 'Delete issue', icon: 'trash', danger: true, onSelect: () => onDelete(issue) });
  return entries;
}
