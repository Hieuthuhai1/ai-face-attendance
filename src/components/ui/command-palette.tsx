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
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (open) {
      setSearch((prev) => "");
      setSelectedIndex((prev) => 0);
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
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 animate-scale-in",
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
        >
          <div className="p-4 border-b border-slate-200">
            <label htmlFor="command-input" className="sr-only">
              {title}
            </label>
            <div className="relative">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                id="command-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 bg-white text-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                autoComplete="off"
                autoFocus
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedItems).map(([groupName, groupItems]) => (
              <div key={groupName} className="py-1">
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {groupName}
                </div>
                {groupItems.map((item, index) => {
                  const globalIndex = filteredItems.indexOf(item);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={item.key}
                      ref={(el) => (itemRefs.current[globalIndex] = el)}
                      type="button"
                      onClick={() => {
                        if (!item.disabled) {
                          item.action();
                          onClose();
                        }
                      }}
                      disabled={item.disabled}
                      className={cn(
                        "w-full px-4 py-3 text-left flex items-center gap-3",
                        "hover:bg-slate-50 focus:bg-slate-50",
                        isSelected && "bg-[var(--brand-soft)]",
                        item.disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {item.icon && <span className="w-5 h-5 flex items-center justify-center text-slate-400">{item.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium truncate", isSelected ? "text-[var(--brand)]" : "text-slate-900")}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className={cn("text-xs truncate", isSelected ? "text-[var(--brand)]/80" : "text-slate-500")}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                <Icon name="search" size={24} className="mx-auto text-slate-300 mb-2" />
                <p>Không tìm thấy lệnh phù hợp</p>
                <p className="text-xs mt-1">Thử từ khóa khác</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-[var(--surface-muted)] rounded-b-xl text-center">
            <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
              Esc
            </kbd>{" "}
            <span className="text-xs text-slate-500">Đóng</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 animate-scale-in max-h-[80vh] flex flex-col">
          <header className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100" aria-label="Đóng">
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{category}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-slate-50">
                      <span className="text-sm text-slate-600">{item.description}</span>
                      <kbd className="px-2 py-1 text-[11px] font-mono text-slate-700 bg-slate-100 border border-slate-200 rounded whitespace-nowrap shrink-0">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <footer className="p-4 border-t border-slate-200 bg-[var(--surface-muted)] sticky bottom-0">
            <p className="text-xs text-slate-500 text-center">Nhấn <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded">Esc</kbd> để đóng</p>
          </footer>
        </div>
      </div>
    </Portal>
  );
}