"use client";
import type { ReactNode } from "react";
import { CheckCheck, Plus, Timer } from "lucide-react";
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
  return (
    <div className="day-workspace">
      <div className="day-columns">
        <section className="task-sheet" aria-labelledby="next-steps-title">
          <div className="section-head">
            <div>
              <div className="section-number">01 / DO</div>
              <h2 id="next-steps-title">
                The next steps <span>{openTasks.length}</span>
              </h2>
            </div>
            <button className="text-button" onClick={() => changeView("tasks")}>
              View all
            </button>
          </div>
          {openTasks.length ? (
            openTasks.slice(0, 5).map(taskRow)
          ) : (
            <div className="empty">
              <CheckCheck size={28} />
              <h3>A little breathing room.</h3>
              <p>Add a task when you’re ready.</p>
            </div>
          )}
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
            <div>
              <div className="section-number">02 / KEEP</div>
              <h2 id="thoughts-title">Thoughts nearby</h2>
            </div>
            <button className="text-button" onClick={() => changeView("notes")}>
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
      <section className="planner-ribbon" aria-labelledby="planner-title">
        <div className="planner-intro">
          <div className="section-number">03 / MAKE SPACE</div>
          <h2 id="planner-title">A day that fits.</h2>
          <p>Start with what’s due. Leave room for the rest.</p>
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
            onClick={() => setPlan(dailyPlan(workspace.tasks, budget, today))}
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
  );
}
