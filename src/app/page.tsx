import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoBanner } from "@/components/ui/demo-banner";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmptyState } from "@/components/ui/states";
import { Td, Th, Table } from "@/components/ui/table";

/** Phase 1: trang trạng thái foundation + showcase design system. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Face Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Foundation (Phase 1) — design system, logging, validation, mock provider gate.
        </p>
      </div>

      <DemoBanner />

      <Card>
        <CardTitle>Hành động chính</CardTitle>
        <CardDescription>
          Luồng chấm công, enrollment và quản lý ca triển khai ở Phase 3–6.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/login">
            <Button>Đăng nhập để chấm công</Button>
          </a>
          <Button variant="secondary" disabled title="Có từ Phase 6">
            Chấm công ra
          </Button>
          <Button variant="ghost" disabled title="Có từ Phase 7">
            Lịch sử
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Trạng thái mẫu</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusIndicator status="ontime" />
          <StatusIndicator status="late" />
          <StatusIndicator status="pending" />
          <StatusIndicator status="needs_review" />
          <Badge tone="info">Ca ngày</Badge>
          <Badge tone="neutral">Asia/Ho_Chi_Minh</Badge>
        </div>
      </Card>

      <Card>
        <CardTitle>Bản ghi gần nhất</CardTitle>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th>Ca</Th>
                <Th>Trạng thái</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>—</Td>
                <Td>—</Td>
                <Td>
                  <StatusIndicator status="idle" />
                </Td>
              </tr>
            </tbody>
          </Table>
          <EmptyState
            title="Chưa có bản ghi chấm công"
            description="Dữ liệu thật xuất hiện từ Phase 6."
          />
        </div>
      </Card>
    </main>
  );
}
