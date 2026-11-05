import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type MenuEntry =
  | {
      kind: 'item';
      label: string;
      onSelect: () => void;
      icon?: ReactNode | IconName;
      /** Shows a check and uses menuitemradio semantics. */
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
    }
  | { kind: 'heading'; label: string }
  | { kind: 'separator' };

interface MenuProps {
  /** Accessible name for the trigger button. */
  label: string;
  entries: MenuEntry[];
  trigger?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Rendered text next to the icon on the trigger button. */
  triggerText?: string;
}

export function Menu({ label, entries, trigger, align = 'end', className = '', triggerText }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Position under the trigger, flipping up or sliding left when it would leave the screen.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const p = panelRef.current.getBoundingClientRect();
    const margin = 8;
    let left = align === 'end' ? b.right - p.width : b.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    let top = b.bottom + 4;
    if (top + p.height > window.innerHeight - margin) top = Math.max(margin, b.top - p.height - 4);
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])');
    const checked = panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus();

    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    const onDismiss = () => close(false);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onDismiss);
    window.addEventListener('scroll', onDismiss, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onDismiss);
      window.removeEventListener('scroll', onDismiss, true);
    };
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(idx + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(idx - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className || 'icon-btn'}
        aria-label={triggerText ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close(false);
          else setOpen(true);
        }}
      >
        {trigger ?? <Icon name="more" />}
        {triggerText}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="menu"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          onKeyDown={onKeyDown}
        >
          {entries.map((entry, i) => {
            if (entry.kind === 'separator') return <div key={i} role="separator" className="menu-sep" />;
            if (entry.kind === 'heading') {
              return (
                <div key={i} className="menu-heading" role="presentation">
                  {entry.label}
                </div>
              );
            }
            const isRadio = entry.checked !== undefined;
            return (
              <button
                key={i}
                type="button"
                role={isRadio ? 'menuitemradio' : 'menuitem'}
                aria-checked={isRadio ? entry.checked : undefined}
                disabled={entry.disabled}
                className={`menu-item${entry.danger ? ' menu-item-danger' : ''}`}
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  close(true);
                  entry.onSelect();
                }}
              >
                <span className="menu-item-icon">
                  {typeof entry.icon === 'string' ? <Icon name={entry.icon as IconName} size={16} /> : entry.icon}
                </span>
                <span className="menu-item-label">{entry.label}</span>
                {entry.checked && <Icon name="check" size={16} className="menu-item-check" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
