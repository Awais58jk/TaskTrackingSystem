export type Role = "standard" | "admin";
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  full_name?: string;
  role: Role;
  is_admin?: boolean;
  date_joined?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  owner: User;
  task_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project: Pick<Project, "id" | "name" | "color">;
  title: string;
  description: string;
  due_date: string;
  priority: Priority;
  status: TaskStatus;
  created_by: User;
  assigned_to: User | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  actor: User | null;
  action: string;
  entity_type: string;
  entity_id: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TaskInput {
  project_id: string;
  title: string;
  description: string;
  due_date: string;
  priority: Priority;
  status: TaskStatus;
  assigned_to_id?: string | null;
}

export interface ProjectInput {
  name: string;
  description: string;
  color: string;
}
