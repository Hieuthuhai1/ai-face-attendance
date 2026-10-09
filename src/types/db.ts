/** Minimal DB row types (Phase 3). Mở rộng khi có thêm domain. */

export type Role = "employee" | "manager" | "hr_admin" | "system_admin";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  organization_id: string | null;
  is_active: boolean;
}

export interface Employee {
  id: string;
  organization_id: string;
  profile_id: string | null;
  employee_code: string;
  department_id: string | null;
  manager_id: string | null;
  title: string;
  employment_status: "active" | "inactive" | "terminated";
  hired_at: string | null;
  terminated_at: string | null;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  manager_id: string | null;
}

export interface WorkShift {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  grace_in_min: number;
  grace_out_min: number;
  rounding_min: number;
  break_min: number;
  is_active: boolean;
}

export interface ShiftAssignment {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_id: string;
  effective_from: string;
  effective_to: string | null;
}
