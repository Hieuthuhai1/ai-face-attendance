"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./portal";
import { Icon } from "./icon";

export interface CommandItem {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
  action: () => void;
}

export interface CommandPaletteProps {
  /** Mở/đóng */
  open: boolean;
  /** Callback đóng */
  onClose: () => void;
  /** Các command items */
  items: CommandItem[];
  /** Placeholder tìm kiếm */
  placeholder?: string;
  /** Title */
  title?: string;
  /** Class thêm */
  className?: string;
}

export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = "Tìm kiếm lệnh hoặc điều hướng...",
  title = "Command Palette",
  className,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerSearch) ||
        item.description?.toLowerCase().includes(lowerSearch) ||
        item.shortcut?.toLowerCase().includes(lowerSearch) ||
        item.group?.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  // Group items by group
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      const group = item.group || "Khác";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      const totalItems = filteredItems.length;
      if (totalItems === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item && !item.disabled) {
          item.action();
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trạng thái mỗi lần mở palette
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-16 sm:pt-24">
        <div
          className="fixed inset-0 bg-[var(--navy-950)]/55 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative w-full max-w-2xl overflow-hidden rounded-[18px] border border-[var(--border)] bg-white shadow-[var(--shadow-dialog)] animate-scale-in",
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
        >
          <h2 id="command-palette-title" className="sr-only">
            {title}
          </h2>
          <div className="border-b border-[var(--border)] p-4">
            <label htmlFor="command-input" className="sr-only">
              {title}
            </label>
            <div className="relative">
              <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                ref={inputRef}
                id="command-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)] pl-11 pr-16 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus-visible:border-[var(--brand)] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-ring)]"
                autoComplete="off"
                autoFocus
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--text-3)]">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-slim p-2">
            {Object.entries(groupedItems).map(([groupName, groupItems]) => (
              <div key={groupName} className="py-1">
                <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
                  {groupName}
                </div>
                {groupItems.map((item) => {
                  const globalIndex = filteredItems.indexOf(item);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={item.key}
                      ref={(el) => {
                        itemRefs.current[globalIndex] = el;
                      }}
                      type="button"
                      onClick={() => {
                        if (!item.disabled) {
                          item.action();
                          onClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      disabled={item.disabled}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                        isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-muted)]",
                        item.disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand)]"
                        />
                      ) : null}
                      {item.icon && (
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            isSelected
                              ? "bg-white text-[var(--brand)]"
                              : "bg-[var(--surface-muted)] text-[var(--text-2)]"
                          )}
                        >
                          {item.icon}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-[13.5px] font-semibold", isSelected ? "text-[var(--brand-strong)]" : "text-[var(--text-1)]")}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="truncate text-xs text-[var(--text-3)]">{item.description}</p>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="shrink-0 rounded-md border border-[var(--border)] bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--text-3)]">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="px-4 py-12 text-center text-[var(--text-2)]">
                <Icon name="search" size={26} className="mx-auto mb-2 text-[var(--text-3)]" />
                <p className="text-sm font-semibold text-[var(--navy-900)]">Không tìm thấy lệnh phù hợp</p>
                <p className="mt-1 text-xs text-[var(--text-3)]">Thử từ khóa khác</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-[var(--text-3)]">
            <kbd className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>để đóng</span>
            <span aria-hidden="true">·</span>
            <kbd className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]">↑ ↓</kbd>
            <span>di chuyển</span>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** Hook để sử dụng Command Palette */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const openPalette = () => setOpen(true);
  const closePalette = () => setOpen(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, openPalette, closePalette };
}

/** Keyboard Shortcuts Help Dialog */
export interface KeyboardShortcut {
  key: string;
  description: string;
  category?: string;
}

export interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  title?: string;
}

export function ShortcutsHelp({ open, onClose, shortcuts, title = "Phím tắt" }: ShortcutsHelpProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    shortcuts.forEach((s) => {
      const cat = s.category || "Chung";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [shortcuts]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-[var(--navy-950)]/55 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
        <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-[var(--border)] bg-white shadow-[var(--shadow-dialog)] animate-scale-in">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-white px-5 py-4">
            <h2 className="text-[17px] font-bold text-[var(--navy-900)]">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]" aria-label="Đóng">
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto scrollbar-slim p-5">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">{category}</h3>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-[var(--surface-muted)]">
                      <span className="text-sm text-[var(--text-2)]">{item.description}</span>
                      <kbd className="shrink-0 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 font-mono text-[11px] text-[var(--text-1)]">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <footer className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
            <p className="text-xs text-[var(--text-3)]">
              Nhấn <kbd className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> để đóng
            </p>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
