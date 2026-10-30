"use client";

import { Button } from "./button";
import { Icon } from "./icon";

/** Nút làm mới dữ liệu phía client (server component không truyền được event handler). */
export function RefreshButton({ label = "Làm mới" }: { label?: string }) {
  return (
    <Button onClick={() => window.location.reload()} variant="secondary" size="sm">
      <Icon name="refresh" size={14} /> {label}
    </Button>
  );
}
