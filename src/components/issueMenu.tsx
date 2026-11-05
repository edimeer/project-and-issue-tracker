import { PRIORITY_META, STATUS_META } from '../domain/constants';
import { PRIORITIES, STATUSES } from '../domain/types';
import type { Issue } from '../domain/types';
import type { StoreActions } from '../state/store';
import { PriorityIcon, StatusIcon } from './ui/Badges';
import type { MenuEntry } from './ui/Menu';

interface Args {
  issue: Issue;
  readOnly: boolean;
  actions: StoreActions;
  onOpen: (issue: Issue) => void;
  onDelete: (issue: Issue) => void;
}

/** The per-issue actions menu. This is also the menu-based, non-drag way to change status. */
export function buildIssueMenu({ issue, readOnly, actions, onOpen, onDelete }: Args): MenuEntry[] {
  const entries: MenuEntry[] = [{ kind: 'item', label: readOnly ? 'View issue' : 'Open and edit', icon: 'pencil', onSelect: () => onOpen(issue) }];
  if (readOnly) return entries;
  entries.push({ kind: 'separator' }, { kind: 'heading', label: 'Move to' });
  for (const s of STATUSES) {
    entries.push({
      kind: 'item',
      label: STATUS_META[s].label,
      icon: <StatusIcon status={s} />,
      checked: issue.status === s,
      onSelect: () => void actions.moveIssue(issue.id, s),
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
