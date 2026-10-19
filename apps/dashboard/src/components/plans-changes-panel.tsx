"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import type { EvaluatedOperation, EvaluatedPlan } from "@/lib/desired-state";

type Props = {
  evaluation: EvaluatedPlan | null;
};

const readinessStyles = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
  approval_required: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const readinessLabels = {
  ready: "Ready",
  blocked: "Blocked",
  approval_required: "Approval required",
};

const actionStyles = {
  create: "text-emerald-300",
  update: "text-sky-300",
  delete: "text-red-300",
};

function displayValue(value: unknown): string {
  if (value === undefined) return "Not specified";
  if (value === null) return "null";

  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1 border-b border-white/5 py-3 last:border-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap wrap-break-word text-sm text-slate-300">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function StateComparison({
  operation,
}: {
  operation: EvaluatedOperation["operation"];
}) {
  const desired = operation.desired?.attributes ?? {};
  const observed = operation.observed?.attributes ?? {};
  const keys = [
    ...new Set([...Object.keys(observed), ...Object.keys(desired)]),
  ].sort();

  if (operation.action === "create") {
    return (
      <div className="rounded-lg border border-white/8 bg-black/20 p-3">
        <p className="mb-2 text-xs font-medium text-slate-400">
          Proposed attributes
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
          {JSON.stringify(desired, null, 2)}
        </pre>
        {keys.length === 0 && (
          <p className="text-xs text-slate-500">
            No desired attributes were specified.
          </p>
        )}
      </div>
    );
  }

  if (operation.action === "delete") {
    return (
      <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
        <p className="mb-2 text-xs font-medium text-red-300">
          Resource marked for deletion
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
          {JSON.stringify(observed, null, 2)}
        </pre>
        {!operation.observed && (
          <p className="text-xs text-slate-500">
            No observed attributes were provided.
          </p>
        )}
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No attribute details were provided for this update.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/8">
      <div className="grid grid-cols-2 border-b border-white/8 bg-white/3">
        <p className="px-3 py-2 text-xs font-medium text-slate-400">Observed</p>
        <p className="border-l border-white/8 px-3 py-2 text-xs font-medium text-slate-400">
          Desired
        </p>
      </div>

      {keys.map((key) => {
        const hasObserved = Object.hasOwn(observed, key);
        const hasDesired = Object.hasOwn(desired, key);
        const changed =
          hasObserved !== hasDesired ||
          displayValue(observed[key]) !== displayValue(desired[key]);

        return (
          <div
            key={key}
            className="grid grid-cols-2 border-b border-white/5 last:border-0"
          >
            <div className="min-w-0 p-3">
              <p className="mb-1 wrap-break-word text-xs text-slate-500">
                {key}
              </p>
              <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
                {hasObserved ? displayValue(observed[key]) : "Not present"}
              </pre>
            </div>
            <div
              className={`min-w-0 border-l border-white/8 p-3 ${
                changed ? "bg-sky-500/4" : ""
              }`}
            >
              <p className="mb-1 wrap-break-word text-xs text-slate-500">
                {key}
              </p>
              <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
                {hasDesired ? displayValue(desired[key]) : "Not present"}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OperationCard({
  item,
  index,
}: {
  item: EvaluatedOperation;
  index: number;
}) {
  const { operation } = item;

  const ActionIcon = {
    create: ArrowUpRight,
    update: ArrowLeftRight,
    delete: ArrowDownRight,
  }[operation.action];

  return (
    <article className="rounded-xl border border-white/8 bg-[#0d1018]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/3">
            <ActionIcon size={17} className={actionStyles[operation.action]} />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              Operation {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-1 wrap-break-word text-sm font-semibold text-white">
              <span className={actionStyles[operation.action]}>
                {operation.action.toUpperCase()}
              </span>{" "}
              {operation.resource.type}: {operation.resource.id}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {operation.dependencies.length}{" "}
              {operation.dependencies.length === 1
                ? "dependency"
                : "dependencies"}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs ${
            readinessStyles[item.readiness]
          }`}
        >
          {readinessLabels[item.readiness]}
        </span>
      </div>

      <div className="grid gap-3 border-t border-white/6 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={13} /> Policy
          </p>
          <p className="text-sm text-slate-200">
            {String(item.policy.action ?? "Unknown")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {String(item.policy.reason ?? "No policy explanation provided.")}
          </p>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={13} /> Risk
          </p>
          <p className="text-sm capitalize text-slate-200">
            {String(item.risk.level ?? "Unknown")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {String(item.risk.reason ?? "No risk explanation provided.")}
          </p>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={13} /> Approval
          </p>
          <p className="text-sm text-slate-200">
            {String(item.approval.requirement ?? "Unknown")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {String(
              item.approval.reason ?? "No approval explanation provided.",
            )}
          </p>
        </div>
      </div>

      <div className="border-t border-white/6 px-4 py-3 sm:px-5">
        <details>
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-white">
            Inspect change details
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                State comparison
              </h4>
              <StateComparison operation={operation} />
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dependencies
              </h4>

              {operation.dependencies.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No dependencies declared.
                </p>
              ) : (
                <ul className="space-y-2">
                  {operation.dependencies.map((dependency) => (
                    <li
                      key={`${dependency.type}:${dependency.id}`}
                      className="flex items-center gap-2 text-sm text-slate-300"
                    >
                      <GitBranch
                        size={14}
                        className="shrink-0 text-slate-500"
                      />
                      <span className="break-all">
                        {dependency.type}: {dependency.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Raw operation data
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5 text-slate-300">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

export function PlansChangesPanel({ evaluation }: Props) {
  const operations = evaluation?.operations ?? [];
  const ready = operations.filter((item) => item.readiness === "ready").length;
  const blocked = operations.filter(
    (item) => item.readiness === "blocked",
  ).length;
  const approval = operations.filter(
    (item) => item.readiness === "approval_required",
  ).length;

  return (
    <section
      id="plans-changes"
      className="scroll-mt-6 space-y-5 rounded-xl border border-white/[0.07] bg-[#10131b] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">
              Plans & Changes
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review proposed infrastructure operations, compare state, and
            understand policy, risk, and approval decisions before any
            execution.
          </p>
        </div>

        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          Preview only · no execution
        </span>
      </div>

      {!evaluation ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center">
          <GitBranch size={23} className="text-slate-500" />
          <h3 className="mt-3 text-sm font-medium text-slate-200">
            No evaluated plan yet
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Configure and evaluate desired state above. The resulting
            policy-evaluated operations will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total operations",
                value: operations.length,
                color: "text-white",
              },
              { label: "Ready", value: ready, color: "text-emerald-300" },
              { label: "Blocked", value: blocked, color: "text-red-300" },
              {
                label: "Approval required",
                value: approval,
                color: "text-amber-300",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/[0.07] bg-white/2 p-4"
              >
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {operations.length === 0 ? (
            <div className="rounded-lg border border-white/8 p-5">
              <p className="text-sm font-medium text-slate-200">
                No changes proposed
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                The control plane returned zero operations for this evaluation.
                This can mean no changes are needed within the current
                management scope.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {operations.map((item, index) => (
                <OperationCard
                  key={`${item.operation.resource.type}:${item.operation.resource.id}:${item.operation.action}:${index}`}
                  item={item}
                  index={index}
                />
              ))}
            </div>
          )}

          <p className="text-xs leading-5 text-slate-500">
            This is an evaluation result, not an execution record. A Ready
            operation has passed the current evaluation checks; execution
            success has not been established.
          </p>
        </>
      )}
    </section>
  );
}
