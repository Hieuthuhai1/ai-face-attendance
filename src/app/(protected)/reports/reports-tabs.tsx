"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/tabs";

const ITEMS: TabItem[] = [
  { key: "overview", label: "Tổng quan", icon: <Icon name="home" size={14} /> },
  { key: "analytics", label: "Phân tích", icon: <Icon name="chart" size={14} /> },
  { key: "exceptions", label: "Ngoại lệ", icon: <Icon name="alert" size={14} /> },
  { key: "dept", label: "Theo phòng ban", icon: <Icon name="users" size={14} /> },
  { key: "late", label: "Trễ/Sớm", icon: <Icon name="clock" size={14} /> },
  { key: "missing", label: "Thiếu chấm", icon: <Icon name="help" size={14} /> },
];

export interface ReportsTabsProps {
  overview: ReactNode;
  analytics: ReactNode;
  exceptions: ReactNode;
  dept: ReactNode;
  late: ReactNode;
  missing: ReactNode;
}

/** Client wrapper để quản lý tab cho trang báo cáo (server component). */
export function ReportsTabs({ overview, analytics, exceptions, dept, late, missing }: ReportsTabsProps) {
  const [tab, setTab] = useState<string>("overview");

  return (
    <>
      <Tabs items={ITEMS} value={tab} onChange={setTab} />
      <TabPanel tabKey="overview" value={tab}>{overview}</TabPanel>
      <TabPanel tabKey="analytics" value={tab}>{analytics}</TabPanel>
      <TabPanel tabKey="exceptions" value={tab}>{exceptions}</TabPanel>
      <TabPanel tabKey="dept" value={tab}>{dept}</TabPanel>
      <TabPanel tabKey="late" value={tab}>{late}</TabPanel>
      <TabPanel tabKey="missing" value={tab}>{missing}</TabPanel>
    </>
  );
}
