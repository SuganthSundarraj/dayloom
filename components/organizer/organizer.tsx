"use client";
import { useFocusAlerts } from "./focus-alerts";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Spline,
  LayoutDashboard,
  Brain,
  CalendarDays,
  UserRound,
  ListTodo,
  LogOut,
  Pin,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Inbox,
  Timer,
  Trash2,
} from "lucide-react";
import {
  demoWorkspace,
  localDate,
  searchNotes,
  validateNote,
  validateTask,
  type Note,
  type Task,
  type Workspace,
} from "@/lib/organizer/domain";
import {
  connect,
  deleteRecord,
  loadWorkspace,
  saveRecord,
  parseConfig,
  setDeletedAt,
  convertCapture,
  controlFocus,
} from "@/lib/organizer/repository";
import {
  activeRecords,
  validateCapture,
  transitionFocus,
  type Capture,
  type FocusAction,
  type FocusSession,
  type RecordTable,
} from "@/lib/organizer/features";
import Dialog from "./dialog";
import DayView from "./day-view";
import {
  QuickCapture,
  InboxView,
  WeekView,
  TrashView,
  FocusView,
} from "./productivity-views";

import type { View, Editor } from "./types";
import { TaskEditor, NoteEditor, AccountForm } from "./editors";
const labels = {
  today: "Today",
  inbox: "Inbox",
  week: "Weekly plan",
  tasks: "All tasks",
  notes: "My notes",
  memory: "Memory",
  focus: "Focus timer",
  trash: "Trash",
};
import { blankTask, blankNote } from "./factories";

export default function Organizer() {
  const [workspace, setWorkspace] = useState<Workspace>({
    tasks: [],
    notes: [],
  });
  const [view, setView] = useState<View>("today"),
    [editor, setEditor] = useState<Editor | null>(null),
    [query, setQuery] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false);
  const [budget, setBudget] = useState(120),
    [filter, setFilter] = useState("open"),
    [plan, setPlan] = useState<Task[] | null>(null);
  const client = useRef<SupabaseClient | null>(null),
    generation = useRef({ value: 0 });
  const mutationLock = useRef(false);
  const [undo, setUndo] = useState<{ table: RecordTable; id: string } | null>(
    null,
  );
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const focusAlerts = useFocusAlerts(workspace.sessions ?? []);
  useEffect(() => {
    const counter = generation.current;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const response = await fetch("/api/config");
        if (!response.ok)
          throw new Error("Connection settings are unavailable. Please retry.");
        const config = parseConfig(await response.json());
        if (!active) return;
        setConfigured(config.configured);
        if (!config.configured) {
          setWorkspace(demoWorkspace());
          setDemo(true);
          setLoading(false);
          return;
        }
        const db = connect(config);
        client.current = db;
        const subscription = db.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          counter.value++;
          setUser(session?.user ?? null);
          setWorkspace({ tasks: [], notes: [] });
          setDemo(false);
          setPlan(null);
          setUndo(null);
          setEditor(null);
          setLoading(!!session);
          if (session) {
            const version = counter.value;
            void loadWorkspace(db)
              .then((data) => {
                if (active && version === counter.value) {
                  setWorkspace(data);
                  setLoading(false);
                }
              })
              .catch(() => {
                if (active && version === counter.value) {
                  setError(
                    "Your notes and tasks could not be loaded. Retry from Settings.",
                  );
                  setLoading(false);
                }
              });
          }
        });
        unsubscribe = () => subscription.data.subscription.unsubscribe();
        const { data, error } = await db.auth.getSession();
        if (error)
          throw new Error("Unable to check your session. Please retry.");
        if (active && !data.session) {
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Connection failed. Please retry.",
          );
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      active = false;
      counter.value++;
      unsubscribe?.();
    };
  }, []);
  const today = localDate();
  const activeWorkspace = {
    ...workspace,
    tasks: activeRecords(workspace.tasks),
    notes: activeRecords(workspace.notes),
  };
  const openTasks = activeWorkspace.tasks.filter((t) => !t.completed);
  const visibleTasks = activeWorkspace.tasks.filter(
    (t) =>
      (filter === "all" || (filter === "done" ? t.completed : !t.completed)) &&
      (t.title + " " + t.project).toLowerCase().includes(query.toLowerCase()),
  );
  const notes = searchNotes(workspace.notes, query);
  const canEdit = demo || !!user;
  function openEditor(next: Editor) {
    setError("");
    setStatus("");
    setEditor(next);
  }
  async function save(table: "tasks" | "notes", record: Task | Note) {
    if (mutationLock.current) return false;
    const validation =
      table === "tasks"
        ? validateTask(record as Task)
        : validateNote(record as Note);
    if (validation) {
      setError(validation);
      return false;
    }
    if (!canEdit) {
      setError("Sign in to save your workspace.");
      return false;
    }
    mutationLock.current = true;
    setBusy(true);
    setError("");
    const version = generation.current.value;
    try {
      let savedRecord = record;
      let converted: Capture | undefined;
      const captureId =
        table === "tasks" &&
        editor?.kind === "task" &&
        editor.value.id === record.id
          ? editor.captureId
          : undefined;
      if (!demo) {
        if (!client.current || !user)
          throw new Error("Sign in to save your changes.");
        if (captureId) {
          const result = await convertCapture(
            client.current,
            captureId,
            record as Task,
          );
          savedRecord = result.task;
          converted = result.capture;
        } else await saveRecord(client.current, table, record, user.id);
      } else if (captureId) {
        const capture = workspace.captures?.find(
          (item) => item.id === captureId,
        );
        if (capture)
          converted = {
            ...capture,
            converted_at: new Date().toISOString(),
            converted_task_id: record.id,
          };
      }
      if (version !== generation.current.value) return false;
      setWorkspace((previous) =>
        table === "tasks"
          ? {
              ...previous,
              captures: converted
                ? (previous.captures ?? []).map((item) =>
                    item.id === converted.id ? converted : item,
                  )
                : previous.captures,
              tasks: [
                savedRecord as Task,
                ...previous.tasks.filter((t) => t.id !== savedRecord.id),
              ],
            }
          : {
              ...previous,
              notes: [
                savedRecord as Note,
                ...previous.notes.filter((n) => n.id !== record.id),
              ],
            },
      );
      setPlan(null);
      setEditor(null);
      setStatus(
        demo
          ? "Updated in this demo. Changes reset when you reload."
          : "Saved to your workspace.",
      );
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save. Please retry.",
      );
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function mutateFeature(
    operation: () => Promise<void>,
    update: (previous: Workspace) => Workspace,
    message: string,
  ): Promise<boolean> {
    if (mutationLock.current) return false;
    if (!canEdit) {
      setError("Sign in to save your workspace.");
      return false;
    }
    mutationLock.current = true;
    setBusy(true);
    setError("");
    const version = generation.current.value;
    try {
      if (!demo) await operation();
      if (version !== generation.current.value) return false;
      setWorkspace(update);
      setPlan(null);
      setEditor(null);
      setStatus(demo ? `${message} Demo changes reset on reload.` : message);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save. Please retry.",
      );
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  function database() {
    if (!client.current || !user)
      throw new Error("Sign in to save your changes.");
    return client.current;
  }
  async function capture(text: string) {
    const validation = validateCapture(text);
    if (validation) {
      setError(validation);
      return false;
    }
    const item: Capture = {
      id: crypto.randomUUID(),
      text: text.trim(),
      created_at: new Date().toISOString(),
      deleted_at: null,
      converted_at: null,
      converted_task_id: null,
    };
    return mutateFeature(
      () => saveRecord(database(), "captures", item, user!.id),
      (previous) => ({
        ...previous,
        captures: [item, ...(previous.captures ?? [])],
      }),
      "Added to your inbox.",
    );
  }
  async function moveToTrash(table: RecordTable, id: string, restore = false) {
    const stamp = restore ? null : new Date().toISOString();
    const success = await mutateFeature(
      () => setDeletedAt(database(), table, id, stamp),
      (previous) => ({
        ...previous,
        [table]: (previous[table] ?? []).map((item) =>
          item.id === id ? { ...item, deleted_at: stamp } : item,
        ),
      }),
      restore ? "Item restored." : "Moved to trash.",
    );
    if (success) setUndo(restore ? null : { table, id });
  }
  async function remove(table: RecordTable, id: string, permanent = false) {
    if (!permanent) return moveToTrash(table, id);
    const success = await mutateFeature(
      () => deleteRecord(database(), table, id),
      (previous) => {
        const next = {
          ...previous,
          [table]: (previous[table] ?? []).filter((item) => item.id !== id),
        };
        if (table === "notes")
          next.tasks = next.tasks.map((task) =>
            task.note_id === id ? { ...task, note_id: null } : task,
          );
        if (table === "tasks") {
          next.sessions = next.sessions?.map((session) =>
            session.task_id === id ? { ...session, task_id: null } : session,
          );
          next.captures = next.captures?.map((item) =>
            item.converted_task_id === id
              ? { ...item, converted_task_id: null }
              : item,
          );
        }
        return next;
      },
      "Item permanently deleted.",
    );
    if (success && undo?.table === table && undo.id === id) setUndo(null);
  }
  async function timerControl(session: FocusSession, action: FocusAction) {
    if (action === "start" || action === "resume") {
      if (focusAlerts.soundEnabled) void focusAlerts.enableSound();
    }
    let saved =
      action === "start"
        ? session
        : transitionFocus(session, action, Date.now());
    return mutateFeature(
      async () => {
        saved = await controlFocus(database(), session, action);
      },
      (previous) => ({
        ...previous,
        sessions: [
          saved,
          ...(previous.sessions ?? []).filter((item) => item.id !== saved.id),
        ],
      }),
      action === "finish"
        ? "Focus session recorded."
        : action === "pause"
          ? "Timer paused."
          : "Timer running.",
    );
  }
  async function auth(event: FormEvent<HTMLFormElement>, signup: boolean) {
    event.preventDefault();
    if (!client.current) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const input = {
        email: String(data.get("email")),
        password: String(data.get("password")),
      };
      const result = signup
        ? await client.current.auth.signUp(input)
        : await client.current.auth.signInWithPassword(input);
      if (result.error)
        throw new Error(
          signup
            ? "Account creation failed. Check your details or try again later."
            : "Sign-in failed. Check your email and password.",
        );
      setEditor(null);
      setDemo(false);
      setStatus(
        signup && !result.data.session
          ? "Check your email to confirm your account, then sign in."
          : "Welcome to your workspace.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    if (!client.current || !user) return;
    setBusy(true);
    setError("");
    const version = generation.current.value;
    try {
      const data = await loadWorkspace(client.current);
      if (version === generation.current.value) {
        setWorkspace(data);
        setPlan(null);
        setEditor(null);
      }
    } catch {
      setError("Unable to load your workspace. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function changeView(next: View) {
    setView(next);
    setQuery("");
    setStatus("");
  }
  function taskRow(task: Task) {
    return (
      <div
        className={`task-row ${task.completed ? "completed" : ""}`}
        key={task.id}
      >
        <button
          className="check-button"
          aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
          disabled={busy}
          onClick={() =>
            void save("tasks", { ...task, completed: !task.completed })
          }
        >
          {task.completed ? <Check size={16} /> : <Circle size={21} />}
        </button>
        <button
          className="task-main"
          onClick={() => openEditor({ kind: "task", value: { ...task } })}
        >
          <span>{task.title}</span>
          <small>
            {task.project}
            {task.note_id &&
              (workspace.notes.find((note) => note.id === task.note_id)
                ?.deleted_at
                ? " · Note in trash"
                : " · Linked note")}
          </small>
        </button>
        {!task.completed && (
          <button
            className="icon-button task-focus"
            aria-label={`Focus on ${task.title}`}
            disabled={busy}
            onClick={() => {
              setFocusTaskId(task.id);
              changeView("focus");
            }}
          >
            <Timer size={18} />
          </button>
        )}
        <div className="task-details">
          <span className={`priority ${task.priority}`}>
            <span aria-hidden="true" /> {task.priority}
          </span>
          <span className="duration">
            <Clock3 size={14} />
            {task.minutes} min
          </span>
          {task.due_date && (
            <span
              className={`due-date ${task.due_date < today && !task.completed ? "overdue" : ""}`}
            >
              {task.due_date === today ? "Today" : task.due_date}
            </span>
          )}
          <span className={`task-state ${task.completed ? "done" : "open"}`}>
            {task.completed ? "Completed" : "To do"}
          </span>
        </div>
      </div>
    );
  }
  function noteCard(note: Note) {
    return (
      <button
        className={`note-card ${note.pinned ? "pinned-note" : ""}`}
        key={note.id}
        onClick={() =>
          openEditor({ kind: "note", value: { ...note, tags: [...note.tags] } })
        }
      >
        <div className="note-card-top">
          <FileText size={20} />
          {note.pinned && <Pin size={16} />}
        </div>
        <h3>{note.title}</h3>
        <p>{note.body}</p>
        <div className="tags">
          {note.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </button>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="workspace-header">
        <button
          className="brand"
          onClick={() => changeView("today")}
          aria-label="Dayloom home"
        >
          <span className="brand-mark">
            <Spline size={24} />
          </span>
          <span>
            <span className="brand-accent">Day</span>loom
          </span>
        </button>
        <div className="mobile-tools">
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={() => openEditor({ kind: "settings" })}
          >
            <Settings2 size={19} />
          </button>
          <button
            className="icon-button"
            aria-label={
              user ? `Account for ${user.email}` : "Open your account"
            }
            onClick={() => openEditor({ kind: "account" })}
          >
            <UserRound size={19} />
          </button>
        </div>
        <form
          className="header-search"
          onSubmit={(event) => {
            event.preventDefault();
            setView("tasks");
            setFilter("all");
            setQuery(quickQuery.trim());
            setStatus("");
          }}
        >
          <input
            aria-label="Quick task search"
            placeholder="Search your tasks…"
            value={quickQuery}
            onChange={(event) => setQuickQuery(event.target.value)}
          />
          <button aria-label="Find tasks" type="submit">
            <Search size={19} />
          </button>
        </form>
        <div className="header-tools">
          <span className="mode-badge">
            {demo
              ? "Demo workspace"
              : user
                ? "Connected to Supabase"
                : "Welcome"}
          </span>
          <div className="header-date">
            <CalendarDays size={19} />
            <div>
              <strong>
                {new Date().toLocaleDateString("en", { weekday: "long" })}
              </strong>
              <span>
                {new Date().toLocaleDateString("en", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </header>
      <aside className="workspace-sidebar">
        <button
          className="profile"
          aria-label={user ? `Account for ${user.email}` : "Open your account"}
          onClick={() => openEditor({ kind: "account" })}
        >
          <span className="avatar">
            {user ? user.email?.slice(0, 1).toUpperCase() : "D"}
          </span>
          <strong>{user ? "Your workspace" : "Your personal space"}</strong>
          <span className="profile-label">
            {user ? user.email : "Notes, plans & little wins"}
          </span>
        </button>
        <nav aria-label="Main navigation">
          {(Object.keys(labels) as View[]).map((key) => {
            const Icon =
              key === "today"
                ? LayoutDashboard
                : key === "tasks"
                  ? ListTodo
                  : key === "notes"
                    ? BookOpen
                    : key === "inbox"
                      ? Inbox
                      : key === "week"
                        ? CalendarDays
                        : key === "focus"
                          ? Timer
                          : key === "trash"
                            ? Trash2
                            : Brain;
            return (
              <button
                key={key}
                aria-current={view === key ? "page" : undefined}
                className={view === key ? "nav-item active" : "nav-item"}
                onClick={() => changeView(key)}
              >
                <Icon size={20} />
                {labels[key]}
                {key === "tasks" && (
                  <span className="nav-count">{openTasks.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {workspace.sessions?.some((session) => !session.completed_at) && (
            <button
              className="nav-item focus-mini"
              onClick={() => changeView("focus")}
            >
              <Timer size={19} /> Focus session active
            </button>
          )}
          <button
            className="nav-item"
            aria-label="Open settings"
            onClick={() => openEditor({ kind: "settings" })}
          >
            <Settings2 size={20} />
            Settings
          </button>
          <div className="sidebar-note">
            <Sparkles size={18} />
            <div>
              <strong>Make room for your day.</strong>
              <span>
                AI extraction off. Your essentials work without tokens.
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <main id="workspace">
          <div className="page-heading">
            <div className="heading-copy">
              <h1>
                {view === "today" ? (
                  <>
                    Welcome to your day{" "}
                    <span className="greeting-wave" aria-hidden="true">
                      ✦
                    </span>
                  </>
                ) : view === "tasks" ? (
                  "My tasks"
                ) : view === "notes" ? (
                  "My notebook"
                ) : view === "memory" ? (
                  "Find it in your notes"
                ) : (
                  {
                    inbox: "Catch it now. Sort it later.",
                    week: "A little space for the week",
                    focus: "Make time for one thing",
                    trash: "A second chance",
                  }[view]
                )}
              </h1>
              <p>
                {view === "today"
                  ? "A little focus. A little progress. All in one place."
                  : view === "tasks"
                    ? "Keep your next steps in view."
                    : view === "notes"
                      ? "Your ideas, decisions, and the details worth keeping."
                      : view === "memory"
                        ? "Pick up a thought and return to its original context."
                        : view === "inbox"
                          ? "Keep loose thoughts together until you’re ready to act."
                          : view === "week"
                            ? "Move tasks between days and see how much time you’ve planned."
                            : view === "focus"
                              ? "Start, pause, and finish a session at your own pace."
                              : "Restore an item or choose to remove it for good."}
              </p>
            </div>
            <button
              className="primary"
              disabled={!canEdit || loading || busy}
              onClick={() =>
                openEditor(
                  view === "notes" || view === "memory"
                    ? { kind: "note", value: blankNote() }
                    : { kind: "task", value: blankTask() },
                )
              }
            >
              <Plus size={18} />
              {view === "notes" || view === "memory" ? "New note" : "New task"}
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>Try it out.</strong> This is a sample workspace. Changes
                reset on reload.
              </span>
              <button onClick={() => openEditor({ kind: "account" })}>
                Save your own workspace <ChevronRight size={15} />
              </button>
            </div>
          )}
          {error && !editor && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {status && (
            <div className="alert success" role="status">
              {status}
            </div>
          )}
          {focusAlerts.expired && (
            <div className="undo-bar" role="alert">
              <strong>Time’s up. Your focus timer has ended.</strong>
              <button
                className="text-button"
                onClick={() => changeView("focus")}
              >
                View focus timer
              </button>
            </div>
          )}
          {undo && (
            <div className="undo-bar" role="status">
              <span>Your last trashed item can be restored.</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void moveToTrash(undo.table, undo.id, true)}
              >
                Undo
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty">Loading your workspace…</div>
          ) : !canEdit ? (
            <div className="welcome panel">
              <BookOpen size={32} />
              <h2>A home for your notes and plans.</h2>
              <p>
                Sign in to keep your workspace private and saved across devices.
              </p>
              <button
                className="primary"
                onClick={() => openEditor({ kind: "account" })}
              >
                Sign in or create an account
              </button>
            </div>
          ) : (
            <>
              {view === "today" && (
                <>
                  <QuickCapture busy={busy} capture={capture} />
                  <DayView
                    workspace={activeWorkspace}
                    openTasks={openTasks}
                    today={today}
                    budget={budget}
                    plan={plan}
                    setBudget={setBudget}
                    setPlan={setPlan}
                    changeView={changeView}
                    openEditor={openEditor}
                    taskRow={taskRow}
                    noteCard={noteCard}
                  />
                </>
              )}
              {view === "inbox" && (
                <InboxView
                  captures={workspace.captures ?? []}
                  busy={busy}
                  capture={capture}
                  convert={(item) =>
                    openEditor({
                      kind: "task",
                      value: { ...blankTask(), title: item.text.slice(0, 200) },
                      captureId: item.id,
                    })
                  }
                  trash={(table, id) => void moveToTrash(table, id)}
                />
              )}
              {view === "week" && (
                <WeekView
                  tasks={workspace.tasks}
                  today={today}
                  busy={busy}
                  save={(task) => save("tasks", task)}
                  edit={(task) =>
                    openEditor({ kind: "task", value: { ...task } })
                  }
                />
              )}
              {view === "trash" && (
                <TrashView
                  workspace={workspace}
                  busy={busy}
                  restore={(table, id) => void moveToTrash(table, id, true)}
                  purge={(table, id) =>
                    openEditor({ kind: "delete", table, id, permanent: true })
                  }
                />
              )}
              {view === "focus" && (
                <FocusView
                  sessions={workspace.sessions ?? []}
                  tasks={workspace.tasks}
                  busy={busy}
                  initialTaskId={focusTaskId}
                  control={timerControl}
                  alerts={focusAlerts}
                />
              )}
              {view === "tasks" && (
                <>
                  <div className="tools">
                    <div className="tabs" role="group" aria-label="Task status">
                      {["open", "done", "all"].map((f) => (
                        <button
                          aria-pressed={filter === f}
                          className={filter === f ? "selected" : ""}
                          key={f}
                          onClick={() => setFilter(f)}
                        >
                          {f === "open"
                            ? "To do"
                            : f === "done"
                              ? "Completed"
                              : "All tasks"}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={18} />
                      <input
                        aria-label="Search tasks"
                        placeholder="Find a task or project…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <section className="panel">
                    {visibleTasks.length ? (
                      visibleTasks.map(taskRow)
                    ) : (
                      <div className="empty">
                        <ListTodo size={28} />
                        <h3>No tasks here yet.</h3>
                        <p>Try another filter or create your first task.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {(view === "notes" || view === "memory") && (
                <>
                  <label
                    className={`search ${view === "memory" ? "memory-search" : ""}`}
                  >
                    <Search size={20} />
                    <input
                      aria-label="Search notes"
                      placeholder={
                        view === "memory"
                          ? "Search a topic, decision, or detail…"
                          : "Search notes and tags…"
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {view === "memory" && (
                    <p className="search-help">
                      Search matches words in your notes, titles, and tags. Open
                      a result to read the source. AI answers are off.
                    </p>
                  )}
                  <div
                    className={`note-grid library ${view === "memory" ? "memory-results" : ""}`}
                  >
                    {notes.map(noteCard)}
                  </div>
                  {!notes.length && (
                    <div className="empty">
                      <Search size={28} />
                      <h3>{query ? "No matching notes." : "A fresh page."}</h3>
                      <p>
                        {query
                          ? "Try a different keyword."
                          : "Save your first thought to start your library."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {editor && (
        <Dialog
          busy={busy}
          description={
            editor.kind === "task"
              ? "Add the next step, a priority, and a time estimate."
              : editor.kind === "note"
                ? "Keep your ideas and the context behind your tasks."
                : undefined
          }
          title={
            editor.kind === "task"
              ? workspace.tasks.some((t) => t.id === editor.value.id)
                ? "Edit task"
                : "New task"
              : editor.kind === "note"
                ? workspace.notes.some((n) => n.id === editor.value.id)
                  ? "Your note"
                  : "New note"
                : editor.kind === "account"
                  ? "Your private workspace"
                  : editor.kind === "delete"
                    ? editor.permanent
                      ? "Delete permanently?"
                      : "Move to trash?"
                    : "Settings & connection"
          }
          onClose={() => {
            if (!busy) {
              setEditor(null);
              setError("");
            }
          }}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {editor.kind === "task" && (
            <TaskEditor
              editor={editor}
              workspace={workspace}
              busy={busy}
              openEditor={openEditor}
              setEditor={setEditor}
              save={save}
            />
          )}
          {editor.kind === "note" && (
            <NoteEditor
              editor={editor}
              workspace={workspace}
              busy={busy}
              openEditor={openEditor}
              setEditor={setEditor}
              save={save}
              status={status}
              setStatus={setStatus}
            />
          )}
          {editor.kind === "account" &&
            (user ? (
              <>
                <p>
                  Signed in as {user.email}. Your notes and tasks are private to
                  your account.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (!client.current) return;
                    setBusy(true);
                    const { error } = await client.current.auth.signOut();
                    setBusy(false);
                    if (error) setError("Sign-out failed. Please retry.");
                    else setEditor(null);
                  }}
                >
                  <LogOut size={17} />
                  Sign out
                </button>
              </>
            ) : configured ? (
              <AccountForm busy={busy} onSubmit={auth} />
            ) : (
              <>
                <p>
                  Your Supabase workspace isn’t connected yet. You can explore
                  the demo, but it doesn’t save your information.
                </p>
                <p>
                  Create a free Supabase project, apply the included database
                  migration, and connect its project URL and public publishable
                  key.
                </p>
                <a
                  className="primary"
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Supabase
                </a>
              </>
            ))}
          {editor.kind === "settings" && (
            <>
              <div className="setting-row">
                <strong>Storage</strong>
                <span>
                  {configured
                    ? "Supabase connected"
                    : "Supabase awaiting setup"}
                </span>
              </div>
              <p>
                {demo
                  ? "The demo uses sample data only. Reloading resets changes."
                  : "Your account stores notes and tasks in Supabase."}
              </p>
              <div className="setting-row">
                <strong>AI task extraction</strong>
                <span>Disabled</span>
              </div>
              <p>
                No AI requests or token costs. Manual tasks, notes, keyword
                search, and daily planning work independently.
              </p>
              {user && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  Reload workspace
                </button>
              )}
              <a
                className="text-button"
                href="https://supabase.com/pricing"
                target="_blank"
                rel="noreferrer"
              >
                View Supabase plans
              </a>
            </>
          )}
          {editor.kind === "delete" && (
            <>
              <p>
                {editor.permanent
                  ? "This permanently removes the item and cannot be undone. Any linked tasks are kept."
                  : "You can restore this item from Trash. Linked tasks and notes are kept."}
              </p>
              <div className="dialog-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void remove(editor.table, editor.id, editor.permanent)
                  }
                >
                  {busy
                    ? "Saving…"
                    : editor.permanent
                      ? "Delete permanently"
                      : "Move to trash"}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
