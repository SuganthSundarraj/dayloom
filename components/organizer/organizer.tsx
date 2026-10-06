"use client";
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
  ListTodo,
  LogOut,
  Pin,
  Plus,
  Search,
  Settings2,
  Sparkles,
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
} from "@/lib/organizer/repository";
import Dialog from "./dialog";
import DayView from "./day-view";

import type { View, Editor } from "./types";
import { TaskEditor, NoteEditor, AccountForm } from "./editors";
const labels = {
  today: "Today",
  tasks: "All tasks",
  notes: "My notes",
  memory: "Memory",
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
  const openTasks = workspace.tasks.filter((t) => !t.completed);
  const due = openTasks.filter((t) => t.due_date && t.due_date <= today);
  const visibleTasks = workspace.tasks.filter(
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
    setBusy(true);
    setError("");
    const version = generation.current.value;
    try {
      if (!demo) {
        if (!client.current || !user)
          throw new Error("Sign in to save your changes.");
        await saveRecord(client.current, table, record, user.id);
      }
      if (version !== generation.current.value) return false;
      setWorkspace((previous) =>
        table === "tasks"
          ? {
              ...previous,
              tasks: [
                record as Task,
                ...previous.tasks.filter((t) => t.id !== record.id),
              ],
            }
          : {
              ...previous,
              notes: [
                record as Note,
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
      setBusy(false);
    }
  }
  async function remove(table: "tasks" | "notes", id: string) {
    setBusy(true);
    setError("");
    const version = generation.current.value;
    try {
      if (!demo) {
        if (!client.current || !user)
          throw new Error("Sign in to delete an item.");
        await deleteRecord(client.current, table, id);
      }
      if (version !== generation.current.value) return;
      setWorkspace((prev) =>
        table === "tasks"
          ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }
          : {
              notes: prev.notes.filter((n) => n.id !== id),
              tasks: prev.tasks.map((t) =>
                t.note_id === id ? { ...t, note_id: null } : t,
              ),
            },
      );
      setPlan(null);
      setEditor(null);
      setStatus("Item deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete.");
    } finally {
      setBusy(false);
    }
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
            {task.note_id && " · Linked note"}
          </small>
        </button>
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
        <div className="masthead">
          <button
            className="brand"
            onClick={() => changeView("today")}
            aria-label="Dayloom home"
          >
            <span className="brand-mark">
              <Spline size={26} />
            </span>
            dayloom
            <span className="brand-period" aria-hidden="true">
              /
            </span>
          </button>
          <div className="header-tools">
            <span className="mode-badge">
              {demo
                ? "Demo workspace"
                : user
                  ? "Connected to Supabase"
                  : "Welcome"}
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => openEditor({ kind: "settings" })}
            >
              <Settings2 size={19} />
            </button>
            <button
              className="profile"
              aria-label={
                user ? `Account for ${user.email}` : "Open your account"
              }
              onClick={() => openEditor({ kind: "account" })}
            >
              <span className="avatar">
                {user ? user.email?.slice(0, 1).toUpperCase() : "D"}
              </span>
              <span className="profile-label">
                {user ? user.email : "Your space"}
              </span>
            </button>
          </div>
        </div>
        <div className="navigation-line">
          <nav aria-label="Main navigation">
            {(Object.keys(labels) as View[]).map((key, index) => (
              <button
                key={key}
                aria-current={view === key ? "page" : undefined}
                className={view === key ? "nav-item active" : "nav-item"}
                onClick={() => changeView(key)}
              >
                <span className="nav-index" aria-hidden="true">
                  0{index + 1}
                </span>
                {labels[key]}
                {key === "tasks" && (
                  <span className="nav-count">{openTasks.length}</span>
                )}
              </button>
            ))}
          </nav>
          <span className="navigation-aside">PERSONAL WORKSPACE</span>
        </div>
      </header>
      <div className="main-shell">
        <main id="workspace">
          <div
            className={`page-heading ${view === "today" ? "today-heading" : ""}`}
          >
            {view === "today" && (
              <div
                className="date-stamp"
                aria-label={new Date().toLocaleDateString("en", {
                  dateStyle: "full",
                })}
              >
                <span>
                  {new Date().toLocaleDateString("en", { weekday: "short" })}
                </span>
                <strong>{String(new Date().getDate()).padStart(2, "0")}</strong>
                <span>
                  {new Date().toLocaleDateString("en", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="heading-copy">
              <div className="eyebrow">
                {view === "today"
                  ? "THE DAILY VIEW"
                  : view === "tasks"
                    ? "MOVE THINGS FORWARD"
                    : view === "notes"
                      ? "YOUR NOTEBOOK"
                      : "BACK TO THE SOURCE"}
              </div>
              <h1>
                {view === "today" ? (
                  <>
                    Today, in <em>perspective.</em>
                  </>
                ) : view === "tasks" ? (
                  <>
                    Choose your <em>next move.</em>
                  </>
                ) : view === "notes" ? (
                  <>
                    Thoughts worth <em>keeping.</em>
                  </>
                ) : (
                  <>
                    Find the <em>thread.</em>
                  </>
                )}
              </h1>
              <p>
                {view === "today"
                  ? "Your next steps and the thoughts behind them, together."
                  : view === "tasks"
                    ? "Give each task a little context. Then take the next step."
                    : view === "notes"
                      ? "Keep the details, decisions, and ideas you’ll come back to."
                      : "Search your notes and pick up the original context."}
              </p>
            </div>
            <button
              className="primary"
              disabled={!canEdit || loading}
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
          {canEdit && !loading && (
            <div className="workspace-summary">
              <span>
                <strong>{String(openTasks.length).padStart(2, "0")}</strong>open
                tasks
              </span>
              <span>
                <strong>{String(due.length).padStart(2, "0")}</strong>due today
                & earlier
              </span>
              <span>
                <strong>
                  {String(workspace.notes.length).padStart(2, "0")}
                </strong>
                saved thoughts
              </span>
              <span className="ai-indicator">
                <Sparkles size={14} />
                AI extraction off
              </span>
            </div>
          )}
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
                <DayView
                  workspace={workspace}
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
                    ? "Delete this item?"
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
                This permanently removes the{" "}
                {editor.table === "notes"
                  ? "note. Linked tasks will be kept without the note link"
                  : "task"}
                .
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
                  onClick={() => void remove(editor.table, editor.id)}
                >
                  {busy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
