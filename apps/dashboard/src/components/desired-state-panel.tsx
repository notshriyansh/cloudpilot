"use client";

import { useEffect, useState } from "react";
import {
  emptyDesiredState,
  formatJson,
  parseJson,
  type DesiredState,
  type EvaluatedPlan,
} from "@/lib/desired-state";

type ApiError = {
  error?: string;
  errors?: unknown[];
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiError;

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    return `${body.error ?? "Request failed"}: ${body.errors
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("; ")}`;
  }

  return body.error ?? `Request failed (${response.status})`;
}

type DesiredStatePanelProps = {
  onEvaluationChange: (evaluation: EvaluatedPlan | null) => void;
};

export function DesiredStatePanel({
  onEvaluationChange,
}: DesiredStatePanelProps) {
  const [editor, setEditor] = useState(formatJson(emptyDesiredState));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDesiredState() {
      try {
        const response = await fetch("/api/desired-state", {
          cache: "no-store",
        });

        if (response.status === 404) {
          if (!cancelled) {
            setNotice("No saved desired state yet. Add resources below.");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const result = (await response.json()) as DesiredState;

        if (!cancelled) {
          setEditor(formatJson(result));
          setSaved(true);
          setNotice("Loaded saved desired state.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load desired state.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDesiredState();

    return () => {
      cancelled = true;
    };
  }, []);

  function getDesiredState(): DesiredState {
    const parsed = parseJson(editor);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("resources" in parsed) ||
      !Array.isArray(parsed.resources)
    ) {
      throw new Error(
        'Desired state must be a JSON object containing a "resources" array.',
      );
    }

    return parsed as DesiredState;
  }

  async function saveDesiredState() {
    setError(null);
    setNotice(null);
    setSaving(true);

    try {
      const desired = getDesiredState();

      const response = await fetch("/api/desired-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(desired),
      });

      if (!response.ok) throw new Error(await readError(response));

      const result = (await response.json()) as DesiredState;
      setEditor(formatJson(result));
      setSaved(true);
      onEvaluationChange(null);
      setNotice("Desired state saved. No infrastructure changes were made.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save desired state.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function evaluateDesiredState() {
    setError(null);
    setNotice(null);
    setEvaluating(true);

    try {
      const desired = getDesiredState();

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(desired),
      });

      if (!response.ok) throw new Error(await readError(response));

      const result = (await response.json()) as EvaluatedPlan;

      onEvaluationChange(result);
      setNotice("Evaluation completed. No infrastructure changes were made.");
    } catch (err) {
      onEvaluationChange(null);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to evaluate desired state.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <section
      id="desired-state"
      className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-300">
            Desired state
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Configuration & evaluation
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Define the infrastructure state CloudPilot should target, then
            review the proposed operations and policy readiness.
          </p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          Preview only · no execution
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-white/10 bg-white/3 p-3 text-sm text-slate-300"
        >
          {notice}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="desired-state-json"
            className="text-sm font-medium text-slate-200"
          >
            Desired state JSON
          </label>
          <span className="text-xs text-slate-500">
            {saved ? "Saved configuration exists" : "Not saved yet"}
          </span>
        </div>
        <textarea
          id="desired-state-json"
          spellCheck={false}
          value={editor}
          onChange={(event) => {
            setEditor(event.target.value);
            setSaved(false);
            onEvaluationChange(null);
          }}
          className="min-h-72 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm leading-6 text-slate-200 outline-none focus:border-sky-400/60"
          placeholder={'{\n  "resources": []\n}'}
          disabled={loading}
        />
        <p className="text-xs text-slate-500">
          The control plane performs authoritative schema validation when you
          save or evaluate.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void saveDesiredState()}
          disabled={loading || saving || evaluating}
          className="rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save desired state"}
        </button>
        <button
          type="button"
          onClick={() => void evaluateDesiredState()}
          disabled={loading || saving || evaluating}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {evaluating ? "Evaluating…" : "Evaluate changes"}
        </button>
      </div>
    </section>
  );
}
