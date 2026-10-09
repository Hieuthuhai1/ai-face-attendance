"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportCsv, type ReportFilters } from "@/features/reports/actions";

export function ExportButton({ filters }: { filters: ReportFilters }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setLoading(true);
    setError(null);
    const res = await exportCsv(filters);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button variant="secondary" size="sm" onClick={onExport} loading={loading}>
          Xuất CSV
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">✕ {error}</p>
      ) : null}
    </div>
  );
}
