"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./portal";
import { Icon } from "./icon";
import { Button } from "./button";

export interface ModalProps {
  /** Mở/đóng */
  open: boolean;
  /** Callback đóng */
  onClose: () => void;
  /** Tiêu đề */
  title?: string;
  /** Nội dung */
  children: ReactNode;
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
  /** Không có padding */
  noPadding?: boolean;
  /** Full screen trên mobile */
  fullScreenMobile?: boolean;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

/** Modal component - dialog trung tâm màn hình */
export function Modal({
  open,
  onClose,
  title,
  children,
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
  noPadding = false,
  fullScreenMobile = false,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const trapFocus = (e: KeyboardEvent) => {
    if (!contentRef.current) return;
    const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;

    // Save focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    setTimeout(() => {
      contentRef.current?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) {
        onClose();
      }
      if (e.key === "Tab") {
        trapFocus(e);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className={cn("fixed inset-0 z-[50] flex items-center justify-center p-4", zIndex > 50 && `z-[${zIndex}]`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {overlay && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-hidden="true"
          />
        )}

        <div
          ref={contentRef}
          tabIndex={-1}
          className={cn(
            "relative w-full bg-white rounded-xl shadow-xl animate-scale-in",
            SIZE_CLASSES[size],
            fullScreenMobile && "max-w-full sm:max-w-md",
            className
          )}
        >
          {(title || showCloseButton) && (
            <header className={cn("flex items-center justify-between p-4 border-b border-slate-200", headerClassName)}>
              {title && (
                <h2 id="modal-title" className="text-base font-semibold text-slate-900">
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

          <div className={cn("overflow-y-auto", noPadding ? "p-0" : "p-4", bodyClassName)}>
            {children}
          </div>

          {footer && (
            <footer className={cn("p-4 border-t border-slate-200 bg-[var(--surface-muted)]", "flex items-center justify-end gap-2")}>
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
}

/** Confirm Modal - modal xác nhận hành động */
export interface ConfirmModalProps {
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

export function ConfirmModal({
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
}: ConfirmModalProps) {
  return (
    <Modal
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
    </Modal>
  );
}

/** Form Modal - modal chứa form */
export interface FormModalProps extends Omit<ModalProps, "footer"> {
  /** Form onSubmit */
  onSubmit: (e: React.FormEvent) => void;
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Loading */
  loading?: boolean;
  /** Có hiển thị cancel button */
  showCancel?: boolean;
}

export function FormModal({
  open,
  onClose,
  onSubmit,
  title,
  children,
  submitLabel = "Lưu",
  cancelLabel = "Hủy",
  loading = false,
  showCancel = true,
  size = "md",
  ...props
}: FormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <form onSubmit={onSubmit}>
          <div className="flex justify-end gap-2 w-full">
            {showCancel && (
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                {cancelLabel}
              </Button>
            )}
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </div>
        </form>
      }
      {...props}
    >
      {children}
    </Modal>
  );
}

/** Alert Modal - modal thông báo đơn giản */
export interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  type?: "info" | "success" | "warning" | "error";
  confirmLabel?: string;
  onConfirm?: () => void;
}

const ALERT_ICONS = {
  info: "info",
  success: "check",
  warning: "alert",
  error: "x",
};

const ALERT_COLORS = {
  info: "text-[var(--info)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  error: "text-[var(--danger)]",
};

export function AlertModal({
  open,
  onClose,
  title,
  message,
  type = "info",
  confirmLabel = "Đóng",
  onConfirm,
}: AlertModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={false}
      footer={
        <div className="flex justify-end">
          <Button onClick={() => { onConfirm?.(); onClose(); }}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", ALERT_COLORS[type])}>
          <Icon name={ALERT_ICONS[type]} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    </Modal>
  );
}