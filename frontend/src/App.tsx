import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import clsx from "clsx";
import { format, isToday, parseISO } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import * as api from "./api";
import { AuthProvider, useAuth } from "./auth";
import type { ActivityLog, Priority, Project, ProjectInput, Role, Task, TaskInput, TaskStatus, User } from "./types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
    },
  },
});

const statuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Completed" },
];

const priorities: Array<{ value: Priority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const projectColors = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#be123c"];

function formatDate(value: string): string {
  return format(parseISO(value), "MMM d, yyyy");
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function statusLabel(value: TaskStatus): string {
  return statuses.find((item) => item.value === value)?.label ?? value;
}

function priorityLabel(value: Priority): string {
  return priorities.find((item) => item.value === value)?.label ?? value;
}

function statusClasses(value: TaskStatus): string {
  return {
    todo: "bg-slate-100 text-slate-700 ring-slate-200",
    in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
    blocked: "bg-amber-50 text-amber-800 ring-amber-200",
    done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[value];
}

function priorityClasses(value: Priority): string {
  return {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-cyan-50 text-cyan-700",
    high: "bg-orange-50 text-orange-700",
    urgent: "bg-rose-50 text-rose-700",
  }[value];
}

function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={clsx("grid gap-2 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <input
        id={id}
        className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-950 shadow-sm transition placeholder:text-slate-400"
        {...props}
      />
    </label>
  );
}

function TextArea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={clsx("grid gap-2 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <textarea
        className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-3 text-slate-950 shadow-sm transition placeholder:text-slate-400"
        {...props}
      />
    </label>
  );
}

function SelectField({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={clsx("grid gap-2 text-sm font-medium text-slate-700", className)}>
      <span>{label}</span>
      <select
        className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-950 shadow-sm transition"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4 text-slate-700 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading TaskFlow</span>
      </div>
    </main>
  );
}

function useRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastMessage, setLastMessage] = useState("Live updates ready");

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const source = new EventSource("/api/events/stream");
    source.addEventListener("activity", (event) => {
      const activity = JSON.parse((event as MessageEvent).data) as ActivityLog;
      setLastMessage(activity.message);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    });
    source.onerror = () => setLastMessage("Reconnecting live updates");

    return () => source.close();
  }, [queryClient, user]);

  return lastMessage;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

function LandingPage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[linear-gradient(120deg,#f8fafc_0%,#ecfeff_45%,#fff7ed_100%)]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3 text-lg font-black text-slate-950">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-white">
            TF
          </span>
          TaskFlow
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/app">
              <Button>Open dashboard</Button>
            </Link>
          ) : (
            <>
              <Link className="text-sm font-semibold text-slate-700 hover:text-slate-950" to="/login">
                Log in
              </Link>
              <Link to="/register">
                <Button>Start free</Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-6 pb-12 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <Badge className="bg-white text-teal-700 ring-teal-200">
            <ShieldCheck className="mr-1 h-4 w-4" aria-hidden="true" />
            Secure role-based project tracking
          </Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.02] tracking-normal text-slate-950 md:text-7xl">
            Control project work without losing the thread.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            TaskFlow moves a manual task register into a responsive, accessible web platform with
            dashboards, projects, priority workflows, admin controls, and live activity signals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/app" : "/register"}>
              <Button className="min-w-40">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create workspace
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="min-w-36">
                View demo
              </Button>
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-lg border border-white/70 p-4 shadow-2xl shadow-cyan-950/10">
          <div className="rounded-md bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-cyan-200">Operations dashboard</p>
                <p className="text-2xl font-black">Client Portal Launch</p>
              </div>
              <Badge className="bg-emerald-400/15 text-emerald-100 ring-emerald-300/30">
                Live
              </Badge>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-3">
              {[
                ["24", "Open tasks"],
                ["7", "High priority"],
                ["91%", "On-time rate"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-md bg-white/10 p-4">
                  <p className="text-3xl font-black">{value}</p>
                  <p className="text-sm text-slate-300">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {statuses.slice(0, 3).map((statusItem, index) => (
                <div key={statusItem.value} className="rounded-md bg-white p-3 text-slate-950">
                  <p className="mb-3 text-sm font-bold">{statusItem.label}</p>
                  <div className="space-y-2">
                    <div className="rounded-md border border-slate-200 p-3">
                      <p className="text-sm font-bold">
                        {["Map milestones", "Build filters", "QA mobile flow"][index]}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Due this week</p>
                    </div>
                    <div className="h-16 rounded-md border border-dashed border-slate-200 bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login: signIn, register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const destination = (location.state as { from?: string } | null)?.from ?? "/app";

  useEffect(() => {
    if (user) {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, fullName, password);
      }
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden bg-slate-950 px-10 py-12 text-white lg:grid lg:content-between">
        <Link to="/" className="flex items-center gap-3 text-lg font-black">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-slate-950">
            TF
          </span>
          TaskFlow
        </Link>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-200">
            Built for small teams
          </p>
          <h1 className="mt-5 max-w-xl text-5xl font-black leading-tight tracking-normal">
            Every project, task, owner, and update in one calm workspace.
          </h1>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70"
          onSubmit={handleSubmit}
        >
          <Link to="/" className="mb-8 inline-flex items-center gap-3 font-black text-slate-950 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-white">
              TF
            </span>
            TaskFlow
          </Link>
          <h1 className="text-3xl font-black tracking-normal text-slate-950">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {mode === "login"
              ? "Use your TaskFlow credentials to access the workspace."
              : "Register as a standard user. Admins can promote roles later."}
          </p>

          <div className="mt-6 grid gap-4">
            {mode === "register" && (
              <TextField
                label="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                autoComplete="name"
              />
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}

          <Button className="mt-6 w-full" disabled={submitting} type="submit">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {mode === "login" ? "Log in" : "Register"}
          </Button>

          <p className="mt-5 text-center text-sm text-slate-600">
            {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
            <Link
              className="font-bold text-teal-700 hover:text-teal-900"
              to={mode === "login" ? "/register" : "/login"}
            >
              {mode === "login" ? "Create one" : "Log in"}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

function AppShell() {
  const { user, isAdmin, logout: signOut } = useAuth();
  const navigate = useNavigate();
  const liveMessage = useRealtime();

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  const links = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/projects", label: "Projects", icon: FolderKanban },
    { to: "/app/tasks", label: "Tasks", icon: KanbanSquare },
    ...(isAdmin
      ? [
          { to: "/app/admin/users", label: "Users", icon: Users },
          { to: "/app/admin/activity", label: "Activity", icon: Activity },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link to="/app" className="mb-8 flex items-center gap-3 px-2 text-lg font-black">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-950 text-white">
            TF
          </span>
          TaskFlow
        </Link>
        <nav aria-label="Primary navigation" className="grid gap-2">
          {links.map((item) => (
            <NavLink
              key={item.to}
              end={item.end}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
                {liveMessage}
              </p>
              <p className="font-bold text-slate-950">
                {user?.name || user?.email}
                <Badge className="ml-2 bg-slate-100 text-slate-700 ring-slate-200">
                  {isAdmin ? "Admin" : "Standard"}
                </Badge>
              </p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </Button>
          </div>
          <nav aria-label="Mobile navigation" className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {links.map((item) => (
              <NavLink
                key={item.to}
                end={item.end}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold",
                    isActive ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700",
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <section className="px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-teal-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
    refetchInterval: 15_000,
  });
}

function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: api.listTasks,
    refetchInterval: 15_000,
  });
}

function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: api.listUsers,
    refetchInterval: 30_000,
  });
}

function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const activityQuery = useQuery({
    queryKey: ["activity"],
    queryFn: api.listActivity,
    refetchInterval: 20_000,
  });

  const tasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdue = openTasks.filter((task) => task.is_overdue);
  const highPriority = openTasks.filter((task) => ["high", "urgent"].includes(task.priority));
  const done = tasks.filter((task) => task.status === "done");
  const myTasks = tasks.filter((task) => task.assigned_to?.id === user?.id).slice(0, 5);

  const metrics = [
    { label: "Open tasks", value: openTasks.length, icon: ClipboardList, tone: "bg-blue-50 text-blue-700" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
    { label: "High priority", value: highPriority.length, icon: CalendarDays, tone: "bg-orange-50 text-orange-700" },
    { label: "Completed", value: done.length, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title="Dashboard"
        description="A focused summary of active projects, urgent work, and the latest collaboration signals."
        action={
          <Link to="/app/tasks">
            <Button>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New task
            </Button>
          </Link>
        }
      />

      <div className="grid task-grid gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{metric.value}</p>
              </div>
              <span className={clsx("grid h-12 w-12 place-items-center rounded-md", metric.tone)}>
                <metric.icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-normal">Project health</h2>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
              {projects.length} active projects
            </Badge>
          </div>
          <div className="grid gap-3">
            {projects.map((project) => {
              const projectTasks = tasks.filter((task) => task.project.id === project.id);
              const completed = projectTasks.filter((task) => task.status === "done").length;
              const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
              return (
                <div key={project.id} className="rounded-md border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{project.name}</p>
                      <p className="text-sm text-slate-500">{projectTasks.length} tasks tracked</p>
                    </div>
                    <Badge className="bg-white text-slate-700 ring-slate-200">{progress}%</Badge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progress}%`, backgroundColor: project.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black tracking-normal">
            {isAdmin ? "Recent activity" : "My assigned tasks"}
          </h2>
          <div className="mt-4 grid gap-3">
            {isAdmin
              ? activity.slice(0, 7).map((item) => <ActivityRow key={item.id} item={item} />)
              : myTasks.map((task) => <CompactTask key={task.id} task={task} />)}
            {(isAdmin ? activity.length === 0 : myTasks.length === 0) && (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                Nothing here yet. Create a task to start the workflow.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function ActivityRow({ item }: { item: ActivityLog }) {
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-950">{item.message}</p>
      <p className="mt-1 text-xs text-slate-500">
        {item.actor?.name ?? "System"} · {formatDate(item.created_at)}
      </p>
    </article>
  );
}

function CompactTask({ task }: { task: Task }) {
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-950">{task.title}</p>
        <Badge className={priorityClasses(task.priority)}>{priorityLabel(task.priority)}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">{task.project.name}</p>
    </article>
  );
}

function ProjectsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const projectsQuery = useProjects();
  const [editing, setEditing] = useState<Project | null>(null);
  const archiveMutation = useMutation({
    mutationFn: api.archiveProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  const projects = projectsQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Information architecture"
        title="Projects"
        description="Group tasks into projects so teams can understand ownership, progress, and work context."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="grid task-grid gap-4">
          {projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-3 h-2 w-20 rounded-full" style={{ backgroundColor: project.color }} />
                  <h2 className="truncate text-xl font-black tracking-normal text-slate-950">{project.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                  {project.task_count} tasks
                </Badge>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Owner: {project.owner.name}</span>
                {isAdmin && (
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" onClick={() => setEditing(project)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Archive ${project.name}?`)) {
                          archiveMutation.mutate(project.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Archive
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        {isAdmin && (
          <ProjectForm project={editing} onCancel={() => setEditing(null)} />
        )}
      </div>
    </>
  );
}

function ProjectForm({ project, onCancel }: { project: Project | null; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? "",
    description: project?.description ?? "",
    color: project?.color ?? projectColors[0],
  });

  useEffect(() => {
    setForm({
      name: project?.name ?? "",
      description: project?.description ?? "",
      color: project?.color ?? projectColors[0],
    });
  }, [project]);

  const mutation = useMutation({
    mutationFn: () => (project ? api.updateProject(project.id, form) : api.createProject(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (!project) {
        setForm({ name: "", description: "", color: projectColors[0] });
      }
      onCancel();
    },
  });

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black tracking-normal">
        {project ? "Edit project" : "Create project"}
      </h2>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <TextField
          label="Project name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <TextArea
          label="Description"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          required
        />
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Color</p>
          <div className="flex flex-wrap gap-2">
            {projectColors.map((color) => (
              <button
                key={color}
                type="button"
                className={clsx(
                  "h-10 w-10 rounded-md border-2",
                  form.color === color ? "border-slate-950" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
                aria-label={`Use project color ${color}`}
                onClick={() => setForm((current) => ({ ...current, color }))}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {project ? "Save project" : "Create project"}
          </Button>
          {project && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}

function TasksPage() {
  const { isAdmin } = useAuth();
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const usersQuery = useUsers();
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [editing, setEditing] = useState<Task | null>(null);

  const tasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = [task.title, task.description, task.project.name]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      return (
        matchesSearch &&
        (statusFilter === "all" || task.status === statusFilter) &&
        (priorityFilter === "all" || task.priority === priorityFilter) &&
        (projectFilter === "all" || task.project.id === projectFilter)
      );
    });
  }, [priorityFilter, projectFilter, search, statusFilter, tasks]);

  return (
    <>
      <PageHeader
        eyebrow="Work execution"
        title="Tasks"
        description="Create tasks, inspect ownership, and move work through status columns with admin-controlled edits."
        action={
          <div className="flex rounded-md border border-slate-200 bg-white p-1">
            <Button
              variant={view === "board" ? "primary" : "ghost"}
              onClick={() => setView("board")}
              type="button"
            >
              <KanbanSquare className="h-4 w-4" aria-hidden="true" />
              Board
            </Button>
            <Button
              variant={view === "list" ? "primary" : "ghost"}
              onClick={() => setView("list")}
              type="button"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              List
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <section className="min-w-0">
          <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.3fr_repeat(3,1fr)]">
            <label className="relative grid gap-2 text-sm font-medium text-slate-700">
              <span>Search tasks</span>
              <Search className="pointer-events-none absolute left-3 top-10 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                className="min-h-11 rounded-md border border-slate-200 bg-white pl-10 pr-3 text-slate-950"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, project, description"
              />
            </label>
            <SelectField
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </SelectField>
            <SelectField
              label="Priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as Priority | "all")}
            >
              <option value="all">All priorities</option>
              {priorities.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </SelectField>
            <SelectField
              label="Project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </SelectField>
          </div>

          {view === "board" ? (
            <TaskBoard tasks={filteredTasks} onEdit={setEditing} isAdmin={isAdmin} />
          ) : (
            <TaskTable tasks={filteredTasks} onEdit={setEditing} isAdmin={isAdmin} />
          )}
        </section>

        <TaskForm
          key={editing?.id ?? "create"}
          task={editing}
          projects={projects}
          users={users}
          onCancel={() => setEditing(null)}
        />
      </div>
    </>
  );
}

function TaskBoard({
  tasks,
  isAdmin,
  onEdit,
}: {
  tasks: Task[];
  isAdmin: boolean;
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="grid board-grid gap-4">
      {statuses.map((column) => (
        <section key={column.value} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black tracking-normal text-slate-950">{column.label}</h2>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
              {tasks.filter((task) => task.status === column.value).length}
            </Badge>
          </div>
          <div className="grid gap-3">
            {tasks
              .filter((task) => task.status === column.value)
              .map((task) => (
                <TaskCard key={task.id} task={task} isAdmin={isAdmin} onEdit={onEdit} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  isAdmin,
  onEdit,
}: {
  task: Task;
  isAdmin: boolean;
  onEdit: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  return (
    <article className="rounded-md border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-950">{task.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{task.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className={statusClasses(task.status)}>{statusLabel(task.status)}</Badge>
        <Badge className={priorityClasses(task.priority)}>{priorityLabel(task.priority)}</Badge>
        {task.is_overdue && (
          <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Overdue</Badge>
        )}
      </div>
      <div className="mt-4 text-sm text-slate-500">
        <p>{task.project.name}</p>
        <p>
          Due {isToday(parseISO(task.due_date)) ? "today" : formatDate(task.due_date)}
        </p>
        <p>Assigned to {task.assigned_to?.name ?? "Unassigned"}</p>
      </div>
      {isAdmin && (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => onEdit(task)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(`Delete ${task.title}?`)) {
                deleteMutation.mutate(task.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}

function TaskTable({
  tasks,
  isAdmin,
  onEdit,
}: {
  tasks: Task[];
  isAdmin: boolean;
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-600">
          <tr>
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Assignee</th>
            {isAdmin && <th className="px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="px-4 py-4 font-semibold text-slate-950">{task.title}</td>
              <td className="px-4 py-4">{task.project.name}</td>
              <td className="px-4 py-4">
                <Badge className={statusClasses(task.status)}>{statusLabel(task.status)}</Badge>
              </td>
              <td className="px-4 py-4">
                <Badge className={priorityClasses(task.priority)}>{priorityLabel(task.priority)}</Badge>
              </td>
              <td className="px-4 py-4">{formatDate(task.due_date)}</td>
              <td className="px-4 py-4">{task.assigned_to?.name ?? "Unassigned"}</td>
              {isAdmin && (
                <td className="px-4 py-4">
                  <Button variant="secondary" onClick={() => onEdit(task)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskForm({
  task,
  projects,
  users,
  onCancel,
}: {
  task: Task | null;
  projects: Project[];
  users: User[];
  onCancel: () => void;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TaskInput>({
    project_id: task?.project.id ?? projects[0]?.id ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    due_date: task?.due_date ?? tomorrow(),
    priority: task?.priority ?? "medium",
    status: task?.status ?? "todo",
    assigned_to_id: task?.assigned_to?.id ?? "",
  });

  useEffect(() => {
    if (!form.project_id && projects[0]) {
      setForm((current) => ({ ...current, project_id: projects[0].id }));
    }
  }, [form.project_id, projects]);

  const mutation = useMutation({
    mutationFn: () => (task ? api.updateTask(task.id, form) : api.createTask(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (task) {
        onCancel();
      } else {
        setForm((current) => ({
          ...current,
          title: "",
          description: "",
          due_date: tomorrow(),
          priority: "medium",
          status: "todo",
        }));
      }
    },
  });

  if (task && !isAdmin) {
    return null;
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black tracking-normal">
        {task ? "Edit task" : "Create task"}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Standard users can create tasks. Admins can update and delete existing tasks.
      </p>
      <form className="mt-4 grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}>
        <TextField
          label="Task title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          required
        />
        <TextArea
          label="Description"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          required
        />
        <SelectField
          label="Project"
          value={form.project_id}
          onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}
          required
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Due date"
            type="date"
            value={form.due_date}
            onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            required
          />
          <SelectField
            label="Priority"
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
          >
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>{priority.label}</option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaskStatus }))}
          >
            {statuses.map((statusItem) => (
              <option key={statusItem.value} value={statusItem.value}>{statusItem.label}</option>
            ))}
          </SelectField>
          <SelectField
            label="Assignee"
            value={form.assigned_to_id ?? ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, assigned_to_id: event.target.value || null }))
            }
          >
            <option value="">Unassigned</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </SelectField>
        </div>
        {mutation.error && (
          <p className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700" role="alert">
            {mutation.error instanceof Error ? mutation.error.message : "Unable to save task."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending || projects.length === 0}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {task ? "Save task" : "Create task"}
          </Button>
          {task && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}

function UsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useUsers();
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users and roles"
        description="Promote trusted users to admin or keep them as standard contributors."
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-600">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {(usersQuery.data ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-semibold text-slate-950">{item.name}</td>
                <td className="px-4 py-4">{item.email}</td>
                <td className="px-4 py-4">
                  <select
                    className="min-h-10 rounded-md border border-slate-200 bg-white px-3"
                    value={item.role}
                    onChange={(event) =>
                      roleMutation.mutate({ id: item.id, role: event.target.value as Role })
                    }
                    aria-label={`Change role for ${item.email}`}
                  >
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  {item.date_joined ? formatDate(item.date_joined) : "Recently"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ActivityPage() {
  const activityQuery = useQuery({
    queryKey: ["activity"],
    queryFn: api.listActivity,
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity log"
        description="A transparent record of task, project, and role changes."
        action={
          <Button
            variant="secondary"
            onClick={() => activityQuery.refetch()}
            disabled={activityQuery.isFetching}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <section className="grid gap-3">
        {(activityQuery.data ?? []).map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </section>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/activity"
          element={
            <AdminRoute>
              <ActivityPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
