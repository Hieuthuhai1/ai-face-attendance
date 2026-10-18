"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./portal";
import { Icon } from "./icon";
import { Button } from "./button";

export interface DrawerProps {
  /** Mở/đóng */
  open: boolean;
  /** Callback đóng */
  onClose: () => void;
  /** Tiêu đề */
  title?: string;
  /** Nội dung */
  children: ReactNode;
  /** Vị trí */
  position?: "left" | "right" | "top" | "bottom";
  /** Kích thước */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Có overlay không */
  overlay?: boolean;
  /** Có thể đóng bằng ESC */
  closeOnEsc?: boolean;
  /** Có thể đóng bằng click overlay */
  closeOnOverlayClick?: boolean;
  /** Hiển thị nút đóng */
  showCloseButton?: boolean;
  /** Footer */
  footer?: ReactNode;
  /** Class thêm */
  className?: string;
  /** Body class */
  bodyClassName?: string;
  /** Header class */
  headerClassName?: string;
  /** Z-index */
  zIndex?: number;
}

const SIZE_CLASSES = {
  sm: "w-72 max-w-[90vw]",
  md: "w-96 max-w-[90vw]",
  lg: "w-[32rem] max-w-[90vw]",
  xl: "w-[48rem] max-w-[90vw]",
  full: "w-full max-w-none",
};

const POSITION_CLASSES = {
  left: "left-0 top-0 bottom-0",
  right: "right-0 top-0 bottom-0",
  top: "top-0 left-0 right-0",
  bottom: "bottom-0 left-0 right-0",
};

const POSITION_TRANSITIONS = {
  left: "translate-x-[-100%]",
  right: "translate-x-[100%]",
  top: "translate-y-[-100%]",
  bottom: "translate-y-[100%]",
};

/** Drawer component - panel trượt từ cạnh màn hình */
export function Drawer({
  open,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
  overlay = true,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  footer,
  className,
  bodyClassName,
  headerClassName,
  zIndex = 50,
}: DrawerProps) {
  const positionClass = POSITION_CLASSES[position];
  const transitionClass = POSITION_TRANSITIONS[position];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className={cn("fixed inset-0 z-[50] flex", zIndex > 50 && `z-[${zIndex}]`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
      >
        {overlay && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-hidden="true"
          />
        )}

        <div
          className={cn(
            "relative flex flex-col bg-white shadow-xl animate-slide-in",
            SIZE_CLASSES[size],
            positionClass,
            transitionClass,
            "transition-transform duration-300 ease-out",
            className
          )}
          style={{ transform: open ? "none" : transitionClass }}
        >
          {(title || showCloseButton) && (
            <header className={cn("flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10", headerClassName)}>
              {title && (
                <h2 id="drawer-title" className="text-base font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Đóng"
                  className="ml-auto shrink-0"
                >
                  <Icon name="x" size={20} />
                </Button>
              )}
            </header>
          )}

          <div className={cn("flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>

          {footer && (
            <footer className={cn("p-4 border-t border-slate-200 bg-[var(--surface-muted)] sticky bottom-0", "flex items-center justify-end gap-2")}>
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
}

/** Drawer confirmation - drawer dạng xác nhận */
export interface ConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfirmDrawer({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  loading = false,
  size = "md",
}: ConfirmDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Drawer>
  );
}

/** Mobile Bottom Sheet - drawer từ dưới lên cho mobile */
export interface BottomSheetProps extends Omit<DrawerProps, "position"> {
  /** Snap points (phần trăm chiều cao màn hình) */
  snapPoints?: number[];
  /** Default snap point */
  defaultSnap?: number;
  /** Có handle kéo không */
  showHandle?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = "full",
  overlay = true,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  showCloseButton = false,
  footer,
  snapPoints = [0.5, 0.9],
  defaultSnap = 0.5,
  showHandle = true,
  className,
  bodyClassName,
  headerClassName,
  ...props
}: BottomSheetProps) {
  // Simplified bottom sheet - just render as drawer from bottom
  return (
    <Drawer
      open={open}
      onClose={onClose}
      position="bottom"
      size={size}
      overlay={overlay}
      closeOnEsc={closeOnEsc}
      closeOnOverlayClick={closeOnOverlayClick}
      showCloseButton={showCloseButton}
      title={title}
      footer={footer}
      className={cn("rounded-t-2xl", className)}
      bodyClassName={cn("pb-4", bodyClassName)}
      headerClassName={cn("flex items-center justify-between", headerClassName)}
      {...props}
    >
      {showHandle && (
        <div className="flex justify-center mb-2 -mt-2">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>
      )}
      {children}
    </Drawer>
  );
}