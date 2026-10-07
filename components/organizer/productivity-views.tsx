"use client";
import { useEffect, useState } from "react";
import {
  Inbox,
  Plus,
  Timer,
  Pause,
  Play,
  Check,
  Trash2,
  RotateCcw,
} from "lucide-react";
import type { Note, Task, Workspace } from "@/lib/organizer/domain";
import {
  activeRecords,
  focusSeconds,
  plannedMinutes,
  shiftDate,
  weekDates,
  type Capture,
  type FocusAction,
  type FocusSession,
  type RecordTable,
} from "@/lib/organizer/features";

export function QuickCapture({
  busy,
  capture,
}: {
  busy: boolean;
  capture: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="quick-capture panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await capture(text)) setText("");
      }}
    >
      <label htmlFor="capture-text">
        <Inbox size={19} /> Quick capture
      </label>
      <div className="capture-input-row">
        <textarea
          id="capture-text"
          required
          maxLength={2000}
          rows={2}
          disabled={busy}
          value={text}
          placeholder="A thought, a task, something to come back to…"
          onChange={(event) => setText(event.target.value)}
        />
        <button className="primary" disabled={busy || !text.trim()}>
          <Plus size={17} /> Add to inbox
        </button>
      </div>
    </form>
  );
}

export function InboxView({
  captures,
  busy,
  capture,
  convert,
  trash,
}: {
  captures: Capture[];
  busy: boolean;
  capture: (text: string) => Promise<boolean>;
  convert: (capture: Capture) => void;
  trash: (table: RecordTable, id: string) => void;
}) {
  const pending = activeRecords(captures).filter((item) => !item.converted_at);
  return (
    <div className="feature-stack">
      <QuickCapture busy={busy} capture={capture} />
      <section className="panel inbox-list" aria-label="Inbox thoughts">
        <div className="section-head">
          <h2>
            To sort <span>{pending.length}</span>
          </h2>
        </div>
        {pending.map((item) => (
          <article className="capture-card" key={item.id}>
            <p>{item.text}</p>
            <small>{new Date(item.created_at).toLocaleDateString()}</small>
            <div className="feature-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => convert(item)}
              >
                Create task
              </button>
              <button
                className="icon-button"
                aria-label={`Trash thought: ${item.text.slice(0, 50)}`}
                disabled={busy}
                onClick={() => trash("captures", item.id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
        {!pending.length && (
          <div className="empty">
            <Inbox size={28} />
            <h3>Your inbox is clear.</h3>
            <p>Capture now. Decide what to do with it later.</p>
          </div>
        )}
        {activeRecords(captures).some((item) => item.converted_at) && (
          <details className="converted-thoughts">
            <summary>Converted thoughts</summary>
            {activeRecords(captures)
              .filter((item) => item.converted_at)
              .map((item) => (
                <article className="capture-card" key={item.id}>
                  <p>{item.text}</p>
                  <small>
                    Converted to a task{" "}
                    {new Date(item.converted_at!).toLocaleDateString()}
                  </small>
                </article>
              ))}
          </details>
        )}
      </section>
    </div>
  );
}

export function WeekView({
  tasks,
  today,
  busy,
  save,
  edit,
}: {
  tasks: Task[];
  today: string;
  busy: boolean;
  save: (task: Task) => Promise<boolean>;
  edit: (task: Task) => void;
}) {
  const [cursor, setCursor] = useState(today);
  const [capacity, setCapacity] = useState(120);
  const days = weekDates(cursor);
  const open = activeRecords(tasks).filter((task) => !task.completed);
  function card(task: Task) {
    return (
      <article className="week-task" key={task.id}>
        <button
          className="text-button week-task-title"
          onClick={() => edit(task)}
        >
          {task.title}
        </button>
        <small>
          {task.minutes} min · {task.priority}
          {task.due_date ? ` · Due ${task.due_date}` : ""}
        </small>
        <label className="sr-only" htmlFor={`plan-${task.id}`}>
          Plan {task.title}
        </label>
        <select
          id={`plan-${task.id}`}
          value={task.scheduled_date ?? ""}
          disabled={busy}
          onChange={(event) =>
            void save({ ...task, scheduled_date: event.target.value || null })
          }
        >
          <option value="">Unscheduled</option>
          {task.scheduled_date && !days.includes(task.scheduled_date) && (
            <option value={task.scheduled_date}>{task.scheduled_date}</option>
          )}
          {days.map((day) => (
            <option value={day} key={day}>
              {day}
            </option>
          ))}
        </select>
      </article>
    );
  }
  return (
    <div className="feature-stack">
      <div className="week-toolbar panel">
        <div className="feature-actions">
          <button
            className="secondary"
            onClick={() => setCursor(shiftDate(days[0], -7))}
          >
            Previous week
          </button>
          <button className="secondary" onClick={() => setCursor(today)}>
            This week
          </button>
          <button
            className="secondary"
            onClick={() => setCursor(shiftDate(days[0], 7))}
          >
            Next week
          </button>
        </div>
        <strong>
          {days[0]} — {days[6]}
        </strong>
        <label>
          Daily capacity{" "}
          <select
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          >
            {[60, 120, 240, 480].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes / 60} hours
              </option>
            ))}
          </select>
        </label>
        <p>Planned days organize your week. Due dates stay unchanged.</p>
      </div>
      <div className="week-grid">
        {days.map((day) => {
          const minutes = plannedMinutes(tasks, day);
          return (
            <section
              className={`week-day panel ${day === today ? "is-today" : ""}`}
              key={day}
              aria-label={`Plan for ${day}`}
            >
              <h2>
                {new Date(`${day}T12:00:00`).toLocaleDateString("en", {
                  weekday: "short",
                })}
                <span>{day.slice(5)}</span>
              </h2>
              <p
                className={
                  minutes > capacity ? "capacity-over" : "capacity-count"
                }
              >
                {minutes} / {capacity} min
                {minutes > capacity && " · Over capacity"}
              </p>
              {open.filter((task) => task.scheduled_date === day).map(card)}
              {!open.some((task) => task.scheduled_date === day) && (
                <p className="week-empty">Room to plan.</p>
              )}
            </section>
          );
        })}
      </div>
      <section
        className="panel week-backlog"
        aria-label="Unscheduled and other-week tasks"
      >
        <h2>Not in this week</h2>
        <div className="backlog-grid">
          {open
            .filter(
              (task) =>
                !task.scheduled_date || !days.includes(task.scheduled_date),
            )
            .map(card)}
        </div>
        {!open.some(
          (task) => !task.scheduled_date || !days.includes(task.scheduled_date),
        ) && <p>Every open task has a place in this week.</p>}
      </section>
    </div>
  );
}

export function TrashView({
  workspace,
  busy,
  restore,
  purge,
}: {
  workspace: Workspace;
  busy: boolean;
  restore: (table: RecordTable, id: string) => void;
  purge: (table: RecordTable, id: string) => void;
}) {
  const groups: { table: RecordTable; items: (Task | Note | Capture)[] }[] = [
    { table: "tasks", items: workspace.tasks },
    { table: "notes", items: workspace.notes },
    { table: "captures", items: workspace.captures ?? [] },
  ];
  const count = groups.reduce(
    (total, group) =>
      total + group.items.filter((item) => item.deleted_at).length,
    0,
  );
  return (
    <section className="panel trash-list" aria-label="Recoverable items">
      <p>
        Items stay here until you restore or permanently delete them. Trashed
        notes keep their task links.
      </p>
      {groups.flatMap(({ table, items }) =>
        items
          .filter((item) => item.deleted_at)
          .map((item) => (
            <article className="trash-item" key={`${table}-${item.id}`}>
              <div>
                <h2>{"title" in item ? item.title : item.text}</h2>
                <small>
                  {table === "captures"
                    ? "Inbox thought"
                    : table === "notes"
                      ? "Note"
                      : "Task"}{" "}
                  · Trashed {new Date(item.deleted_at!).toLocaleDateString()}
                </small>
              </div>
              <div className="feature-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => restore(table, item.id)}
                >
                  <RotateCcw size={16} /> Restore
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => purge(table, item.id)}
                >
                  <Trash2 size={16} /> Delete permanently
                </button>
              </div>
            </article>
          )),
      )}
      {!count && (
        <div className="empty">
          <Trash2 size={28} />
          <h3>Nothing in trash.</h3>
          <p>Your deleted items will wait here for you.</p>
        </div>
      )}
    </section>
  );
}

export function FocusView({
  sessions,
  tasks,
  busy,
  initialTaskId,
  control,
}: {
  sessions: FocusSession[];
  tasks: Task[];
  busy: boolean;
  initialTaskId: string | null;
  control: (session: FocusSession, action: FocusAction) => Promise<boolean>;
}) {
  const [taskId, setTaskId] = useState(initialTaskId ?? "");
  const [minutes, setMinutes] = useState(25);
  const [now, setNow] = useState(() => Date.now());
  const current = sessions.find((session) => !session.completed_at);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = current ? focusSeconds(current, now) : 0;
  const remaining = Math.max(
    0,
    (current?.target_minutes ?? minutes) * 60 - elapsed,
  );
  const task = tasks.find((item) => item.id === current?.task_id);
  const completed = sessions.filter((session) => session.completed_at);
  return (
    <div className="focus-layout">
      <section className="panel focus-panel" aria-label="Focus timer">
        <div className="section-number">
          <Timer size={18} /> ONE THING AT A TIME
        </div>
        <h2>
          {current ? (task?.title ?? "Open focus") : "Choose your next focus"}
        </h2>
        <div className="timer-display" role="timer" aria-label="Time remaining">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </div>
        {current ? (
          <>
            <p role="status">
              {remaining === 0
                ? "Time’s up. Finish to record your session."
                : current.running_since
                  ? "Timer running"
                  : "Timer paused"}
            </p>
            <div className="feature-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void control(
                    current,
                    current.running_since ? "pause" : "resume",
                  )
                }
              >
                {current.running_since ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}
                {current.running_since ? "Pause" : "Resume"}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void control(current, "finish")}
              >
                <Check size={17} /> Finish session
              </button>
            </div>
            <p className="focus-help">
              Elapsed: {Math.floor(elapsed / 60)} min {elapsed % 60} sec. Your
              task is completed separately.
            </p>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const stamp = new Date().toISOString();
              void control(
                {
                  id: crypto.randomUUID(),
                  task_id: taskId || null,
                  target_minutes: minutes,
                  elapsed_seconds: 0,
                  running_since: stamp,
                  completed_at: null,
                  created_at: stamp,
                  updated_at: stamp,
                },
                "start",
              );
            }}
          >
            <fieldset disabled={busy} className="editor-fields">
              <label>
                Focus on{" "}
                <select
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                >
                  <option value="">Open focus</option>
                  {activeRecords(tasks)
                    .filter((item) => !item.completed)
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Session duration (minutes)
                <input
                  type="number"
                  required
                  min={5}
                  max={480}
                  step={1}
                  value={minutes}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
              </label>
              <button className="primary">
                <Play size={17} /> Start focus
              </button>
            </fieldset>
          </form>
        )}
      </section>
      <section className="panel focus-history" aria-label="Focus history">
        <h2>Recent focus</h2>
        {completed.slice(0, 20).map((session) => (
          <article key={session.id}>
            <strong>
              {tasks.find((item) => item.id === session.task_id)?.title ??
                "Open focus"}
            </strong>
            <span>
              {Math.floor(session.elapsed_seconds / 60)} min{" "}
              {session.elapsed_seconds % 60} sec
            </span>
            <small>{new Date(session.completed_at!).toLocaleString()}</small>
          </article>
        ))}
        {!completed.length && <p>Your finished sessions will appear here.</p>}
      </section>
    </div>
  );
}
