"use client";
import { useState, type FormEvent } from "react";
import { Trash2, Sparkles } from "lucide-react";
import {
  extractTasks,
  type Task,
  type Note,
  type Workspace,
} from "@/lib/organizer/domain";
import type { Editor } from "./types";
import { blankTask } from "./factories";
type CommonProps = {
  workspace: Workspace;
  busy: boolean;
  openEditor: (editor: Editor) => void;
  setEditor: (editor: Editor | null) => void;
  save: (table: "tasks" | "notes", record: Task | Note) => Promise<boolean>;
};
export function TaskEditor({
  editor,
  workspace,
  busy,
  openEditor,
  setEditor,
  save,
}: CommonProps & { editor: Extract<Editor, { kind: "task" }> }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save("tasks", {
          ...editor.value,
          title: editor.value.title.trim(),
          project: editor.value.project.trim() || "Personal",
        });
      }}
    >
      <label>
        Task title
        <input
          autoFocus
          required
          maxLength={200}
          value={editor.value.title}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, title: e.target.value },
            })
          }
          placeholder="What’s the next step?"
        />
      </label>
      <div className="form-grid">
        <label>
          Project
          <input
            maxLength={80}
            value={editor.value.project}
            onChange={(e) =>
              setEditor({
                ...editor,
                value: { ...editor.value, project: e.target.value },
              })
            }
          />
        </label>
        <label>
          Priority
          <select
            value={editor.value.priority}
            onChange={(e) =>
              setEditor({
                ...editor,
                value: {
                  ...editor.value,
                  priority: e.target.value as Task["priority"],
                },
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Due date
          <input
            type="date"
            value={editor.value.due_date ?? ""}
            onChange={(e) =>
              setEditor({
                ...editor,
                value: {
                  ...editor.value,
                  due_date: e.target.value || null,
                },
              })
            }
          />
        </label>
        <label>
          Duration (minutes)
          <input
            type="number"
            required
            min={5}
            max={480}
            value={editor.value.minutes}
            onChange={(e) =>
              setEditor({
                ...editor,
                value: {
                  ...editor.value,
                  minutes: Number(e.target.value),
                },
              })
            }
          />
        </label>
      </div>
      <label>
        Linked note
        <select
          value={editor.value.note_id ?? ""}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: {
                ...editor.value,
                note_id: e.target.value || null,
              },
            })
          }
        >
          <option value="">No linked note</option>
          {workspace.notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </label>
      {editor.value.note_id && (
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!(await save("tasks", editor.value))) return;
            const n = workspace.notes.find(
              (n) => n.id === editor.value.note_id,
            );
            if (n) openEditor({ kind: "note", value: { ...n } });
          }}
        >
          Read linked note
        </button>
      )}
      <div className="dialog-actions">
        {workspace.tasks.some((t) => t.id === editor.value.id) && (
          <button
            className="danger"
            type="button"
            disabled={busy}
            onClick={() =>
              openEditor({
                kind: "delete",
                table: "tasks",
                id: editor.value.id,
              })
            }
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save task"}
        </button>
      </div>
    </form>
  );
}
export function NoteEditor({
  editor,
  workspace,
  busy,
  openEditor,
  setEditor,
  save,
  status,
  setStatus,
}: CommonProps & {
  editor: Extract<Editor, { kind: "note" }>;
  status: string;
  setStatus: (status: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save("notes", {
          ...editor.value,
          title: editor.value.title.trim(),
        });
      }}
    >
      <label>
        Note title
        <input
          autoFocus
          required
          maxLength={200}
          value={editor.value.title}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, title: e.target.value },
            })
          }
          placeholder="Give this thought a title"
        />
      </label>
      <label>
        Your note
        <textarea
          required
          maxLength={20000}
          rows={8}
          value={editor.value.body}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, body: e.target.value },
            })
          }
          placeholder="Start anywhere. It doesn’t need to be perfect."
        />
      </label>
      <label>
        Tags (separate with commas)
        <input
          maxLength={300}
          value={editor.value.tags.join(",")}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: {
                ...editor.value,
                tags: [
                  ...new Set(
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                ].slice(0, 10),
              },
            })
          }
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={editor.value.pinned}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, pinned: e.target.checked },
            })
          }
        />
        Pin this note
      </label>
      <div className="extraction-box">
        <div>
          <Sparkles size={18} />
          <strong>AI task extraction</strong>
          <span className="mode-badge">Off</span>
        </div>
        <p>Keep writing. AI is optional and never required to save a note.</p>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            void extractTasks().then((result) => setStatus(result.message))
          }
        >
          Check availability
        </button>
        {status && <p role="status">{status}</p>}
      </div>
      <div className="dialog-actions">
        {workspace.notes.some((n) => n.id === editor.value.id) && (
          <>
            <button
              className="danger"
              type="button"
              disabled={busy}
              onClick={() =>
                openEditor({
                  kind: "delete",
                  table: "notes",
                  id: editor.value.id,
                })
              }
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await save("notes", editor.value))
                  openEditor({
                    kind: "task",
                    value: blankTask(editor.value.id),
                  });
              }}
            >
              Create linked task
            </button>
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}

export function AccountForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    signup: boolean,
  ) => Promise<void>;
}) {
  const [signup, setSignup] = useState(false);
  return (
    <form onSubmit={(e) => void onSubmit(e, signup)}>
      <p>
        {signup
          ? "Create an account to save your notes and tasks."
          : "Welcome back. Your workspace is waiting."}
      </p>
      <label>
        Email
        <input
          autoFocus
          type="email"
          name="email"
          required
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          minLength={8}
          required
          autoComplete={signup ? "new-password" : "current-password"}
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => setSignup(!signup)}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
