"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  ExecutionRecord,
  ExecutionResult,
  VerificationResult,
} from "@cloudpilot/domain";
import { parseLatestExecutionResponse } from "@/lib/execution-response";

type LoadState = "loading" | "ready" | "empty" | "error";

function formatTimestamp(value: string | undefined): string {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replaceAll("-", " ");
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    succeeded: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    verified: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    failed: "border-red-400/20 bg-red-400/10 text-red-300",
    mismatch: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
        styles[status] ?? "border-white/10 bg-white/4 text-slate-300"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function operationLabel(result: ExecutionResult): string {
  const operation = result.operation as unknown as Record<string, unknown>;
  const action =
    typeof operation.action === "string"
      ? operation.action
      : typeof operation.type === "string"
        ? operation.type
        : "Operation";

  const resource =
    typeof operation.resource === "object" && operation.resource !== null
      ? (operation.resource as Record<string, unknown>)
      : undefined;

  const resourceType =
    resource && typeof resource.type === "string" ? resource.type : undefined;
  const resourceId =
    resource && typeof resource.id === "string" ? resource.id : undefined;

  const resourceLabel = [resourceType, resourceId].filter(Boolean).join(":");

  return resourceLabel ? `${action} · ${resourceLabel}` : action;
}

function shortError(error: string): string {
  const normalized = error.replace(/\s+/g, " ").trim();
  return normalized.length > 240
    ? `${normalized.slice(0, 237)}...`
    : normalized;
}

function ResourceChangeItem({
  change,
}: {
  change: NonNullable<VerificationResult["diff"]>["changes"][number];
}) {
  const resource =
    change.type === "update"
      ? change.desired.resource
      : change.resource.resource;

  const changeStyles: Record<string, string> = {
    create: "text-emerald-300",
    update: "text-amber-300",
    delete: "text-red-300",
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/6 bg-black/10 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{resource.type}</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-500">
          {resource.id}
        </p>
      </div>
      <span
        className={`text-xs font-medium capitalize ${changeStyles[change.type]}`}
      >
        {change.type}
      </span>
    </div>
  );
}

function ExecutionDetails({ execution }: { execution: ExecutionRecord }) {
  const summary = execution.summary;
  const verification = execution.verification;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/6 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Started</p>
          <p className="mt-1 text-sm text-slate-300">
            {formatTimestamp(execution.startedAt)}
          </p>
        </div>
        <div className="rounded-lg border border-white/6 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="mt-1 text-sm text-slate-300">
            {formatTimestamp(execution.completedAt)}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
          Operation summary
        </p>

        {summary ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Completed",
                count: summary.completed,
                color: "text-emerald-300",
              },
              {
                label: "Failed",
                count: summary.failed,
                color: "text-red-300",
              },
              {
                label: "Skipped",
                count: summary.skipped,
                color: "text-slate-300",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/6 bg-black/10 p-3"
              >
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`mt-1 text-xl font-semibold ${item.color}`}>
                  {item.count}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Operation summary is not available yet.
          </p>
        )}

        {summary && summary.results.length > 0 && (
          <div className="mt-3 space-y-2">
            {summary.results.map((result, index) => (
              <div
                key={`${execution.id}-${index}`}
                className="rounded-lg border border-white/6 bg-black/10 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 wrap-break-word text-sm text-slate-300">
                    {operationLabel(result)}
                  </p>
                  <StatusBadge status={result.status} />
                </div>
                {result.error && result.status === "failed" && (
                  <p className="mt-2 wrap-break-word text-xs leading-5 text-red-300/90">
                    {shortError(result.error)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] pt-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-indigo-300" />
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Verification
          </p>
        </div>

        {!verification ? (
          <p className="text-sm text-slate-500">
            Verification is not available for this execution yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                {verification.status === "verified"
                  ? "Observed infrastructure matches the desired state."
                  : verification.status === "mismatch"
                    ? "Observed infrastructure differs from the desired state."
                    : "Verification could not be completed."}
              </p>
              <StatusBadge status={verification.status} />
            </div>

            {verification.error && (
              <p className="text-sm leading-5 text-red-300/90">
                {shortError(verification.error)}
              </p>
            )}

            {verification.diff && verification.diff.changes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {verification.diff.changes.length} resource difference
                  {verification.diff.changes.length === 1 ? "" : "s"}
                </p>
                {verification.diff.changes.map((change, index) => (
                  <ResourceChangeItem
                    key={`${change.type}-${index}`}
                    change={change}
                  />
                ))}
              </div>
            )}

            {verification.status === "verified" &&
              verification.diff?.changes.length === 0 && (
                <p className="text-xs text-emerald-300/80">
                  No resource differences detected.
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExecutionPanel() {
  const [execution, setExecution] = useState<ExecutionRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLatestExecution = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoadState("loading");

    setError(null);

    try {
      const response = await fetch("/api/executions/latest", {
        cache: "no-store",
      });

      const body: unknown =
        response.status === 404 ? undefined : await response.json();

      const result = parseLatestExecutionResponse(response.status, body);

      if (result.kind === "empty") {
        setExecution(null);
        setLoadState("empty");
        return;
      }

      setExecution(result.execution);
      setLoadState("ready");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the latest execution.",
      );
      setLoadState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialExecution() {
      try {
        const response = await fetch("/api/executions/latest", {
          cache: "no-store",
        });

        if (cancelled) return;

        const body: unknown =
          response.status === 404 ? undefined : await response.json();

        const result = parseLatestExecutionResponse(response.status, body);

        if (cancelled) return;

        if (result.kind === "empty") {
          setExecution(null);
          setLoadState("empty");
          return;
        }

        setExecution(result.execution);
        setLoadState("ready");
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load the latest execution.",
        );
        setLoadState("error");
      }
    }

    void loadInitialExecution();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="scroll-mt-6 rounded-xl border border-white/[0.07] bg-[#10131b] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity size={17} className="text-indigo-400" />
          Execution &amp; verification
        </div>

        <button
          type="button"
          onClick={() => void loadLatestExecution(true)}
          disabled={refreshing || loadState === "loading"}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Inspect the latest execution, individual operation outcomes, and
        verification against the desired infrastructure state.
      </p>

      {loadState === "loading" && (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
          <CircleDashed size={16} className="animate-spin" />
          Loading latest execution...
        </div>
      )}

      {loadState === "empty" && (
        <div className="mt-5 rounded-lg border border-dashed border-white/10 p-5 text-center">
          <Clock3 size={20} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-300">
            No executions yet
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            An execution will appear here after a plan has been run.
          </p>
        </div>
      )}

      {loadState === "error" && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-red-400/15 bg-red-400/4 p-4"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-300" />
          <div>
            <p className="text-sm font-medium text-red-200">
              Could not load execution
            </p>
            <p className="mt-1 wrap-break-word text-xs leading-5 text-slate-400">
              {error}
            </p>
          </div>
        </div>
      )}

      {loadState === "ready" && execution && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {execution.status === "succeeded" ? (
                <CheckCircle2 size={18} className="text-emerald-300" />
              ) : execution.status === "failed" ? (
                <XCircle size={18} className="text-red-300" />
              ) : (
                <CircleDashed
                  size={18}
                  className="animate-spin text-blue-300"
                />
              )}
              <span className="text-sm font-medium text-slate-200">
                Execution outcome
              </span>
            </div>
            <StatusBadge status={execution.status} />
          </div>

          <div className="mt-3 rounded-lg border border-white/6 bg-black/10 p-3">
            <p className="text-xs text-slate-500">Execution ID</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-300">
              {execution.id}
            </p>
          </div>

          <ExecutionDetails execution={execution} />
        </>
      )}
    </section>
  );
}
