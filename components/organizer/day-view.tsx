"use client";
import type { CSSProperties, ReactNode } from "react";
import {
  CheckCheck,
  Plus,
  Timer,
  ListTodo,
  ChartPie,
  BookOpen,
} from "lucide-react";
import {
  dailyPlan,
  searchNotes,
  type Task,
  type Note,
  type Workspace,
} from "@/lib/organizer/domain";
import { blankTask, blankNote } from "./factories";
import type { Editor, View } from "./types";
type Props = {
  workspace: Workspace;
  openTasks: Task[];
  today: string;
  budget: number;
  plan: Task[] | null;
  setBudget: (value: number) => void;
  setPlan: (value: Task[] | null) => void;
  changeView: (view: View) => void;
  openEditor: (editor: Editor) => void;
  taskRow: (task: Task) => ReactNode;
  noteCard: (note: Note) => ReactNode;
};
export default function DayView({
  workspace,
  openTasks,
  today,
  budget,
  plan,
  setBudget,
  setPlan,
  changeView,
  openEditor,
  taskRow,
  noteCard,
}: Props) {
  const completed = workspace.tasks.filter((task) => task.completed);
  const total = workspace.tasks.length;
  const due = openTasks.filter(
    (task) => task.due_date && task.due_date <= today,
  );
  const metrics = [
    {
      label: "Completed",
      count: completed.length,
      percent: total ? Math.round((completed.length / total) * 100) : 0,
      color: "var(--ring-completed)",
    },
    {
      label: "To do",
      count: openTasks.length,
      percent: total ? Math.round((openTasks.length / total) * 100) : 0,
      color: "var(--ring-todo)",
    },
    {
      label: "Due / overdue",
      count: due.length,
      percent: total ? Math.round((due.length / total) * 100) : 0,
      color: "var(--ring-due)",
    },
  ];
  return (
    <div className="day-workspace">
      <div className="day-columns">
        <div className="dashboard-primary">
          <section className="task-sheet" aria-labelledby="next-steps-title">
            <div className="section-head">
              <h2 id="next-steps-title">
                <ListTodo size={21} />
                To do <span>{openTasks.length}</span>
              </h2>
              <button
                className="text-button"
                onClick={() => changeView("tasks")}
              >
                View all
              </button>
            </div>
            <p className="section-caption">
              {new Date().toLocaleDateString("en", {
                day: "numeric",
                month: "long",
              })}{" "}
              <span>• Your next steps</span>
            </p>
            <div className="task-stack">
              {openTasks.length ? (
                openTasks.slice(0, 5).map(taskRow)
              ) : (
                <div className="empty">
                  <CheckCheck size={28} />
                  <h3>All caught up.</h3>
                  <p>Add a task when you’re ready.</p>
                </div>
              )}
            </div>
            <button
              className="add-row"
              onClick={() => openEditor({ kind: "task", value: blankTask() })}
            >
              <Plus size={18} />
              Add a task
            </button>
          </section>
          <section className="thought-shelf" aria-labelledby="thoughts-title">
            <div className="section-head">
              <h2 id="thoughts-title">
                <BookOpen size={21} />
                Notes nearby
              </h2>
              <button
                className="text-button"
                onClick={() => changeView("notes")}
              >
                All notes
              </button>
            </div>
            <div className="nearby-notes">
              {searchNotes(workspace.notes, "").slice(0, 2).map(noteCard)}
            </div>
            <button
              className="capture-note"
              onClick={() => openEditor({ kind: "note", value: blankNote() })}
            >
              <Plus size={17} />
              Catch a thought
            </button>
          </section>
        </div>
        <div className="dashboard-secondary">
          <section className="status-panel" aria-labelledby="task-status-title">
            <div className="section-head">
              <h2 id="task-status-title">
                <ChartPie size={21} />
                Task status
              </h2>
              <span className="section-total">{total} total</span>
            </div>
            <div className="status-rings">
              {metrics.map((metric) => (
                <div
                  className="status-metric"
                  key={metric.label}
                  style={
                    {
                      "--ring-color": metric.color,
                      "--ring-value": `${metric.percent}%`,
                    } as CSSProperties
                  }
                >
                  <div className="status-ring" aria-hidden="true">
                    <strong>
                      {metric.percent}
                      <small>%</small>
                    </strong>
                  </div>
                  <span className="metric-label">{metric.label}</span>
                  <span className="metric-count">
                    {metric.count} {metric.count === 1 ? "task" : "tasks"}
                  </span>
                  <span className="sr-only">
                    {metric.percent}% of all tasks
                  </span>
                </div>
              ))}
            </div>
            <p className="status-footnote">
              Due / overdue tasks are included in To do.
            </p>
          </section>
          <section
            className="completed-panel"
            aria-labelledby="completed-title"
          >
            <div className="section-head">
              <h2 id="completed-title">
                <CheckCheck size={21} />
                Completed tasks
              </h2>
              <span className="section-total">{completed.length}</span>
            </div>
            <div className="task-stack">
              {completed.length ? (
                completed.slice(0, 2).map(taskRow)
              ) : (
                <div className="empty compact">
                  <p>Your finished tasks will appear here.</p>
                </div>
              )}
            </div>
          </section>
          <section className="planner-ribbon" aria-labelledby="planner-title">
            <div className="planner-intro">
              <div className="section-number">
                <Timer size={16} /> DAILY PLANNER
              </div>
              <h2 id="planner-title">Plan your day</h2>
              <p>Choose your available time. We’ll fit the next steps.</p>
            </div>
            <div className="planner-controls">
              <label htmlFor="budget">
                <Timer size={16} />
                Time available
              </label>
              <select
                id="budget"
                value={budget}
                onChange={(e) => {
                  setBudget(Number(e.target.value));
                  setPlan(null);
                }}
              >
                {[30, 60, 90, 120, 180, 240, 480].map((min) => (
                  <option key={min} value={min}>
                    {min < 60 ? `${min} minutes` : `${min / 60} hours`}
                  </option>
                ))}
              </select>
            </div>
            <div className="planner-action">
              <button
                className="primary"
                onClick={() =>
                  setPlan(dailyPlan(workspace.tasks, budget, today))
                }
              >
                Build my plan
              </button>
              <small>No AI tokens needed.</small>
            </div>
            {plan && (
              <div className="plan-result" role="status">
                <div className="plan-result-heading">
                  <strong>
                    {plan.length
                      ? `${plan.reduce((sum, t) => sum + t.minutes, 0)} of ${budget} minutes planned`
                      : "No tasks fit this time window."}
                  </strong>
                  <span>YOUR SUGGESTED PLAN</span>
                </div>
                <ol>
                  {plan.map((t) => (
                    <li key={t.id}>
                      <span>{t.title}</span>
                      <strong>{t.minutes} min</strong>
                    </li>
                  ))}
                </ol>
                <p>Future-dated tasks stay off today’s plan.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
