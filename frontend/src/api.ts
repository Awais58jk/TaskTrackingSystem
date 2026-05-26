import type { ActivityLog, Project, ProjectInput, Role, Task, TaskInput, User } from "./types";

const API_ROOT = "/api";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function readCookie(name: string): string {
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1]) : "";
}

export async function ensureCsrf(): Promise<string> {
  const existing = readCookie("csrftoken");
  if (existing) {
    return existing;
  }
  await fetch(`${API_ROOT}/auth/csrf`, { credentials: "include" });
  return readCookie("csrftoken");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRFToken", await ensureCsrf());
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : "The request could not be completed.";
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function getMe(): Promise<User | null> {
  try {
    return await request<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      return null;
    }
    throw error;
  }
}

export function login(email: string, password: string): Promise<User> {
  return request<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, full_name: string, password: string): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, full_name, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export function createProject(input: ProjectInput): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, input: Partial<ProjectInput>): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export function listTasks(): Promise<Task[]> {
  return request<Task[]>("/tasks");
}

export function createTask(input: TaskInput): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE" });
}

export function listUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

export function updateUserRole(id: string, role: Role): Promise<User> {
  return request<User>("/users", {
    method: "PATCH",
    body: JSON.stringify({ id, role }),
  });
}

export function listActivity(): Promise<ActivityLog[]> {
  return request<ActivityLog[]>("/activity");
}
