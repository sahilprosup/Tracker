export type UserRole = "site_worker" | "coordinator" | "admin";
export type VisiType = "inspection" | "task" | "hold_point";
export type ItemStatus = "open" | "submitted" | "closed";
export type SyncStatus = "not_synced" | "pending" | "synced" | "failed";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  slack_user_id: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  visibuild_project_id: string | null;
  name: string;
  company: string | null;
  slack_channel_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  project_id: string;
  label: string;
  time_of_day: string;
  target_count: number;
}

export interface ItpItem {
  id: string;
  project_id: string;
  visibuild_visi_id: string | null;
  visi_type: VisiType;
  alias: string | null;
  location_path: string | null;
  code: string | null;
  description: string;
  assignee: string | null;
  status: ItemStatus;
  visibuild_sync_status: SyncStatus;
  visibuild_last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  itp_item_id: string;
  submitted_by: string;
  photo_path: string;
  note: string | null;
  submitted_at: string;
  checkpoint_id: string | null;
  visibuild_sync_status: SyncStatus;
  visibuild_synced_at: string | null;
  visibuild_sync_error: string | null;
}

export interface DailyReport {
  id: string;
  project_id: string;
  report_date: string;
  submission_count: number;
  checkpoint_summary: Record<string, { target: number; actual: number }>;
  generated_at: string;
  posted_to_slack: boolean;
}
