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
import { AttributeChange, getAttributeChanges } from "@/lib/attribute-diff";
import { buildOperationSummary } from "@/lib/operation-summary";
import { buildSafetyContext } from "@/lib/safety-context";
import { buildOperationImpact } from "@/lib/operation-impact";
import { buildPlanReview } from "@/lib/plan-review";

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

const planReviewStyles = {
  empty: "border-white/10 bg-white/5 text-slate-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
  approval_required: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  review_required: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const actionStyles = {
  create: "text-emerald-300",
  update: "text-sky-300",
  delete: "text-red-300",
};

function resourceKey(resource: { type: string; id: string }): string {
  return JSON.stringify([resource.type, resource.id]);
}

function displayValue(value: unknown): string {
  if (value === undefined) return "Not specified";
  if (value === null) return "null";

  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}

function StateComparison({
  operation,
}: {
  operation: EvaluatedOperation["operation"];
}) {
  const desiredResource = operation.desired;
  const observedResource = operation.observed;

  const desired = desiredResource?.attributes ?? {};
  const observed = observedResource?.attributes ?? {};

  const changes = getAttributeChanges(observed, desired);

  const statusStyles: Record<AttributeChange["status"], string> = {
    added: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
    changed: "border-sky-500/20 bg-sky-500/5 text-sky-300",
    removed: "border-red-500/20 bg-red-500/5 text-red-300",
    unchanged: "border-white/10 bg-white/[0.02] text-slate-400",
  };

  const statusLabels: Record<AttributeChange["status"], string> = {
    added: "Added",
    changed: "Changed",
    removed: "Removed",
    unchanged: "Unchanged",
  };

  if (operation.action === "create") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
          <p className="text-sm font-medium text-emerald-300">New resource</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            CloudPilot proposes creating this resource. Review the desired
            attributes below; an empty object is not a complete deployment
            configuration.
          </p>
        </div>

        {Object.keys(desired).length === 0 ? (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
            No desired attributes were specified.
          </p>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-5 text-slate-300">
            {JSON.stringify(desired, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (operation.action === "delete") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-sm font-medium text-red-300">
            Resource marked for deletion
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Review the observed attributes to understand which resource is
            targeted.
          </p>
        </div>

        {!observedResource ? (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
            No observed resource details were returned. Confirm the target
            before relying on this proposal.
          </p>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-5 text-slate-300">
            {JSON.stringify(observed, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (!observedResource && !desiredResource) {
    return (
      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
        Neither desired nor observed resource details were returned for this
        update. There is not enough information to compare attributes.
      </p>
    );
  }

  if (!observedResource) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
          Observed state is unavailable for this operation. The empty observed
          attributes below are not evidence that the actual resource has no
          attributes.
        </p>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">
            Desired attributes
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-5 text-slate-300">
            {JSON.stringify(desired, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <p className="rounded-lg border border-white/8 bg-white/2 p-3 text-sm text-slate-400">
        No attributes were returned for comparison. Check the resource details
        before concluding that the states match.
      </p>
    );
  }

  const counts = {
    added: changes.filter((change) => change.status === "added").length,
    changed: changes.filter((change) => change.status === "changed").length,
    removed: changes.filter((change) => change.status === "removed").length,
    unchanged: changes.filter((change) => change.status === "unchanged").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["added", "changed", "removed", "unchanged"] as const).map(
          (status) => (
            <span
              key={status}
              className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles[status]}`}
            >
              {statusLabels[status]}: {counts[status]}
            </span>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/8">
        <div className="grid grid-cols-2 border-b border-white/8 bg-white/3">
          <p className="px-3 py-2 text-xs font-medium text-slate-400">
            Observed
          </p>
          <p className="border-l border-white/8 px-3 py-2 text-xs font-medium text-slate-400">
            Desired
          </p>
        </div>

        {changes.map((change) => (
          <div
            key={change.key}
            className="grid grid-cols-2 border-b border-white/5 last:border-0"
          >
            <div className="min-w-0 p-3">
              <p className="mb-1 break-all text-xs text-slate-500">
                {change.key}
              </p>
              <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
                {change.status === "added"
                  ? "Not present"
                  : displayValue(change.observed)}
              </pre>
            </div>

            <div className="min-w-0 border-l border-white/8 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="break-all text-xs text-slate-500">{change.key}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyles[change.status]}`}
                >
                  {statusLabels[change.status]}
                </span>
              </div>

              <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-300">
                {change.status === "removed"
                  ? "Not present in desired state"
                  : displayValue(change.desired)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationCard({
  item,
  index,
  operations,
}: {
  item: EvaluatedOperation;
  index: number;
  operations: EvaluatedOperation[];
}) {
  const { operation } = item;

  const safetyContext = buildSafetyContext(item);

  const impact = buildOperationImpact(item, operations);

  const safetyToneStyles = {
    danger: "border-red-500/20 bg-red-500/5 text-red-300",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-200",
    caution: "border-orange-500/20 bg-orange-500/5 text-orange-200",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
  };

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

      <div className="border-t border-white/6 px-4 py-3 sm:px-5">
        <p className="text-sm leading-6 text-slate-300">
          {buildOperationSummary(operation)}
        </p>
      </div>

      <div className="border-t border-white/6 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">
            Dependencies & impact
          </p>
          <span className="text-xs text-slate-500">
            {impact.position > 0
              ? `Planned position ${impact.position} of ${impact.totalOperations}`
              : "Position unavailable"}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-white/2 p-3">
            <p className="text-xs font-medium text-slate-400">
              Related dependency operations
            </p>

            {impact.prerequisites.length === 0 &&
            impact.unresolvedDependencies.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No dependencies declared.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {impact.prerequisites.map((related) => (
                  <li
                    key={`${related.resource.type}:${related.resource.id}`}
                    className="text-sm text-slate-300"
                  >
                    <span className="text-indigo-300">
                      Operation {String(related.index + 1).padStart(2, "0")}
                    </span>
                    {" · "}
                    {related.action} {related.resource.type}:{" "}
                    {related.resource.id}
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {related.relationship === "before"
                        ? "Expected before this operation."
                        : "Expected after this operation."}
                    </p>
                  </li>
                ))}

                {impact.unresolvedDependencies.map((dependency) => (
                  <li
                    key={`${dependency.type}:${dependency.id}`}
                    className="text-sm text-amber-200"
                  >
                    {dependency.type}: {dependency.id}
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      No matching operation in this evaluation. Its current
                      state has not been verified by this result.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-white/2 p-3">
            <p className="text-xs font-medium text-slate-400">
              Direct downstream operations
            </p>

            {impact.downstreamOperations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No direct dependents were identified in this plan. This does not
                establish that other infrastructure dependents are absent.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {impact.downstreamOperations.map((related) => (
                  <li
                    key={`${related.resource.type}:${related.resource.id}`}
                    className="text-sm text-slate-300"
                  >
                    <span className="text-indigo-300">
                      Operation {String(related.index + 1).padStart(2, "0")}
                    </span>
                    {" · "}
                    {related.action} {related.resource.type}:{" "}
                    {related.resource.id}
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {related.relationship === "before"
                        ? "Expected before this operation."
                        : "Expected after this operation."}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Impact is limited to direct relationships represented by
              operations in this evaluation. It does not establish the complete
              infrastructure impact. The planner&apos;s operation order remains
              authoritative.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/6 px-4 py-3 sm:px-5">
        <div
          className={`rounded-lg border p-3 ${safetyToneStyles[safetyContext.tone]}`}
        >
          <p className="text-sm font-semibold">{safetyContext.heading}</p>

          <p className="mt-1 text-sm leading-5 text-slate-300">
            {safetyContext.explanation}
          </p>

          <ul className="mt-3 space-y-1.5">
            {safetyContext.checks.map((check) => (
              <li
                key={check}
                className="flex items-start gap-2 text-xs leading-5 text-slate-400"
              >
                <span aria-hidden="true" className="mt-0.5">
                  •
                </span>
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
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
                  {operation.dependencies.map((dependency) => {
                    const relatedIndex = operations.findIndex(
                      (candidate) =>
                        resourceKey(candidate.operation.resource) ===
                        resourceKey(dependency),
                    );

                    const relatedOperation =
                      relatedIndex >= 0 ? operations[relatedIndex] : undefined;

                    const isReverseDeleteOrdering =
                      operation.action === "delete" &&
                      relatedOperation?.operation.action === "delete";

                    return (
                      <li
                        key={resourceKey(dependency)}
                        className="rounded-lg border border-white/8 bg-black/15 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <GitBranch
                            size={14}
                            className="mt-0.5 shrink-0 text-slate-500"
                          />

                          <div className="min-w-0">
                            <p className="break-all text-sm text-slate-200">
                              {dependency.type}: {dependency.id}
                            </p>

                            {relatedOperation ? (
                              <p className="mt-1 text-xs leading-5 text-indigo-300">
                                Operation{" "}
                                {String(relatedIndex + 1).padStart(2, "0")} in
                                this plan
                              </p>
                            ) : (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                No operation for this resource appears in the
                                current evaluation.
                              </p>
                            )}

                            {isReverseDeleteOrdering && (
                              <p className="mt-1 text-xs leading-5 text-amber-300">
                                Both resources have deletion operations. The
                                planner handles their deletion order separately.
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
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
  const review = evaluation ? buildPlanReview(evaluation) : null;

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

          {review && (
            <div className="rounded-xl border border-white/[0.07] bg-white/2 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Plan review
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {review.heading}
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                    {review.explanation}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${planReviewStyles[review.status]}`}
                >
                  {review.status === "approval_required"
                    ? "Approval required"
                    : review.status === "review_required"
                      ? "Review required"
                      : review.status === "blocked"
                        ? "Blocked"
                        : review.status === "empty"
                          ? "No operations"
                          : "Checks passed"}
                </span>
              </div>

              {review.attentionItems.length > 0 && (
                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <p className="text-xs font-medium text-slate-400">
                    Items requiring attention ({review.attentionItems.length})
                  </p>

                  <ul className="mt-3 space-y-2">
                    {review.attentionItems.map((item) => (
                      <li
                        key={`${item.resource.type}:${item.resource.id}:${item.index}`}
                        className="rounded-lg border border-white/[0.07] bg-black/10 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-indigo-300">
                            Operation {String(item.index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm font-medium text-slate-200">
                            {item.action} {item.resource.type}:{" "}
                            {item.resource.id}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-300">
                          {item.heading}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.explanation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
              <div className="rounded-lg border border-white/[0.07] bg-white/2 p-4">
                <p className="text-sm font-medium text-slate-200">
                  Operation order
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Operations are displayed in the order returned by the control
                  plane planner. This is a planned order, not an execution
                  record.
                </p>
              </div>

              {operations.map((item, index) => (
                <OperationCard
                  key={`${item.operation.resource.type}:${item.operation.resource.id}:${item.operation.action}:${index}`}
                  item={item}
                  index={index}
                  operations={operations}
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
