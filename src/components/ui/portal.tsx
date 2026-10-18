"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Portal component - render children vào document.body */
export function Portal({
  children,
  container,
}: {
  children: ReactNode;
  container?: HTMLElement | null;
}) {
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Render nothing on server, portal on client
  if (typeof window === "undefined") return null;
  if (!mounted) return null;

  const target = container ?? document.body;
  return createPortal(children, target);
}

/** Portal với auto-positioning cho dropdown/tooltip */
export function AutoPortal({
  children,
  anchorRef,
  placement = "bottom",
  offset = 8,
  flip = true,
  container,
}: {
  children: ReactNode;
  anchorRef: React.RefObject<HTMLElement>;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  offset?: number;
  flip?: boolean;
  container?: HTMLElement | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [styles, setStyles] = useState<React.CSSProperties>({});

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);

    function updatePosition() {
      if (!anchorRef.current) return;

      const anchor = anchorRef.current.getBoundingClientRect();
      const content = (container ?? document.body).querySelector("[data-portal-content]") as HTMLElement;
      if (!content) return;

      const contentRect = content.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = anchor.bottom + offset;
      let left = anchor.left;
      let actualPlacement = placement;

      if (placement === "auto" || placement === "bottom") {
        if (top + contentRect.height > viewportHeight && anchor.top > contentRect.height) {
          // Flip to top
          top = anchor.top - contentRect.height - offset;
          actualPlacement = "top";
        }
      }

      if (placement === "auto" || placement === "top") {
        if (top < 0) {
          top = anchor.bottom + offset;
          actualPlacement = "bottom";
        }
      }

      // Horizontal adjustment
      if (left + contentRect.width > viewportWidth) {
        left = viewportWidth - contentRect.width - 8;
      }
      if (left < 8) {
        left = 8;
      }

      setStyles({ top, left, position: "fixed", zIndex: 50 });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef, placement, offset, flip, container]);

  if (!mounted) return null;

  return createPortal(
    <div data-portal-content style={styles}>{children}</div>,
    container ?? document.body
  );
}