"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Box,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Command,
  GitBranch,
  LayoutDashboard,
  LoaderCircle,
  Network,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Search,
} from "lucide-react";
import { DesiredStatePanel } from "@/components/desired-state-panel";
import { PlansChangesPanel } from "@/components/plans-changes-panel";
import type { EvaluatedPlan } from "@/lib/desired-state";
import {
  filterInventoryResources,
  getResourceDisplayName,
  getSafeResourceAttributes,
  RESOURCE_TYPES,
  type InventoryResource,
  type InventoryResourceType,
} from "@/lib/resource-inventory";

type Resource = InventoryResource;

type Observation = {
  id: string;
  startedAt: string;
  completedAt: string;
  status: string;
  state: {
    resources: Resource[];
  };
};

const navigation = [
  { label: "Overview", id: "overview", icon: LayoutDashboard },
  { label: "Infrastructure", id: "infrastructure", icon: Cloud },
  { label: "Plans & Changes", id: "plans-changes", icon: GitBranch },
  { label: "Executions", id: "executions", icon: Terminal },
  { label: "Policies", id: "policies", icon: ShieldCheck },
];

export default function DashboardPage() {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluatedPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceType, setResourceType] = useState<
    InventoryResourceType | "all"
  >("all");
  const [selectedResourceKey, setSelectedResourceKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedObservation() {
      try {
        const response = await fetch("/api/state", {
          cache: "no-store",
        });

        if (response.status === 404) return;

        const result: unknown = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof result === "object" &&
              result !== null &&
              "error" in result &&
              typeof result.error === "string"
              ? result.error
              : "Unable to load saved infrastructure state.",
          );
        }

        if (!cancelled) {
          setObservation(result as Observation);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load saved infrastructure state.",
          );
        }
      }
    }

    void loadSavedObservation();

    return () => {
      cancelled = true;
    };
  }, []);

  async function inspectInfrastructure() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inspect", {
        method: "GET",
        cache: "no-store",
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Infrastructure inspection failed.";

        throw new Error(message);
      }

      setObservation(result as Observation);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected inspection error.",
      );
    } finally {
      setLoading(false);
    }
  }

  const resources = observation?.state?.resources ?? [];
  const count = (type: InventoryResourceType) =>
    resources.filter((item) => item.resource?.type === type).length;

  const filteredResources = filterInventoryResources(
    resources as InventoryResource[],
    searchQuery,
    resourceType,
  );

  const selectedResource =
    filteredResources.find(
      (item) =>
        `${item.resource.type}:${item.resource.id}` === selectedResourceKey,
    ) ??
    filteredResources[0] ??
    null;

  const safeAttributes = selectedResource
    ? getSafeResourceAttributes(selectedResource.attributes)
    : {};

  const cards = [
    {
      label: "Total resources",
      value: observation ? resources.length : "—",
      icon: Box,
    },
    {
      label: "Workers",
      value: observation ? count("worker") : "—",
      icon: Terminal,
    },
    {
      label: "Zones",
      value: observation ? count("zone") : "—",
      icon: Network,
    },
    {
      label: "DNS records",
      value: observation ? count("dns_record") : "—",
      icon: Activity,
    },
    {
      label: "KV namespaces",
      value: observation ? count("kv_namespace") : "—",
      icon: Cloud,
    },
  ];

  return (
    <main id="overview" className="min-h-screen bg-[#090b10] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/[0.07] bg-[#0c0e14] lg:flex">
        <div className="flex h-19] items-center gap-3 border-b border-white/[0.07] px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500 text-white">
            <Command size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">CloudPilot</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              INFRASTRUCTURE CONTROL
            </p>
          </div>
        </div>

        <nav aria-label="Workspace navigation" className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.2em] text-slate-600">
            WORKSPACE
          </p>
          {navigation.map(({ label, id, icon: Icon }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                document.getElementById(id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                index === 0
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:bg-white/4 hover:text-white"
              }`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {index === 1 && observation && (
                <span className="ml-auto text-xs text-slate-500">
                  {resources.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/[0.07] p-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="size-2 rounded-full bg-emerald-400" />
            Dashboard available
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">
            Control-plane connectivity is checked when you run an inspection.
          </p>
        </div>
      </aside>

      <section className="lg:ml-64">
        <header className="flex h-19 items-center justify-between border-b border-white/[0.07] px-5 sm:px-9">
          <div>
            <p className="text-xs text-slate-500">CloudPilot / Workspace</p>
            <h1 className="mt-1 text-sm font-medium">
              Infrastructure overview
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-white/8 px-3 py-1.5 text-xs text-slate-400 sm:flex">
              <span
                className={`size-1.5 rounded-full ${
                  observation ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
              {observation ? "Inspection completed" : "Awaiting inspection"}
            </span>
            <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-xs font-medium">
              CP
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-360 space-y-8 p-5 sm:p-9">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-indigo-400">
                Control plane
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Infrastructure at a glance.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Observe your Cloudflare resources, understand infrastructure
                drift, and evaluate changes before execution.
              </p>
            </div>
            <button
              type="button"
              onClick={inspectInfrastructure}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              {loading ? "Inspecting..." : "Inspect infrastructure"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/6 p-4"
            >
              <CircleAlert className="mt-0.5 shrink-0 text-red-400" size={18} />
              <div>
                <p className="text-sm font-medium text-red-300">
                  Inspection unsuccessful
                </p>
                <p className="mt-1 text-sm text-slate-400">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, icon: Icon }) => (
              <article
                key={label}
                className="rounded-xl border border-white/[0.07] bg-[#10131b] p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">{label}</p>
                  <Icon size={17} className="text-slate-500" />
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  {value}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  {observation ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      Live observation
                    </>
                  ) : (
                    "Run an inspection to populate"
                  )}
                </div>
              </article>
            ))}
          </div>

          <section
            id="infrastructure"
            className="scroll-mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-[#10131b]"
          >
            <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold">Discovered resources</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Resources returned by the control-plane inventory.
                </p>
              </div>
              {observation && (
                <span className="text-xs text-slate-500">
                  Observed {new Date(observation.completedAt).toLocaleString()}
                </span>
              )}
            </div>

            {observation && (
              <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">
                    Search infrastructure resources
                  </span>
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, identifier, or type..."
                    className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/60"
                  />
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-400">
                  <span>Type</span>
                  <select
                    value={resourceType}
                    onChange={(event) =>
                      setResourceType(
                        event.target.value as InventoryResourceType | "all",
                      )
                    }
                    className="h-10 min-w-40 rounded-lg border border-white/10 bg-[#0c0e14] px-3 text-sm text-slate-200 outline-none focus:border-indigo-400/60"
                  >
                    <option value="all">All resources</option>
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {!observation && !loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl border border-white/8 bg-white/3">
                  <Cloud size={22} className="text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-medium">
                  No observation loaded
                </p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  Inspect your infrastructure to retrieve actual resources from
                  your configured Cloudflare account.
                </p>
              </div>
            ) : loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-400">
                <LoaderCircle size={18} className="animate-spin" />
                Querying the control plane...
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-200">
                  {resources.length === 0
                    ? "No resources discovered"
                    : "No matching resources"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {resources.length === 0
                    ? "The inspection completed successfully but returned no resources."
                    : "Try another search term or resource type."}
                </p>
                {resources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setResourceType("all");
                      setSelectedResourceKey(null);
                    }}
                    className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/6 text-xs text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Resource</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Identifier</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredResources.map((item, index) => (
                        <tr
                          key={`${item.resource?.type ?? "resource"}-${item.resource?.id ?? index}`}
                          className="transition hover:bg-white/2"
                        >
                          <td className="px-5 py-4 font-medium">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedResourceKey(
                                  `${item.resource.type}:${item.resource.id}`,
                                )
                              }
                              aria-pressed={
                                `${selectedResource?.resource.type}:${selectedResource?.resource.id}` ===
                                `${item.resource.type}:${item.resource.id}`
                              }
                              className="max-w-full wrap-break-word text-left text-slate-200 hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                            >
                              {getResourceDisplayName(item)}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-slate-400">
                            {item.resource?.type ?? "Unknown"}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {item.resource?.id ?? "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Observed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedResource && (
                  <div className="border-t border-white/[0.07] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">
                          Selected resource
                        </p>
                        <h4 className="mt-2 wrap-break-word text-base font-semibold text-white">
                          {getResourceDisplayName(selectedResource)}
                        </h4>
                        <p className="mt-1 break-all font-mono text-xs text-slate-500">
                          {selectedResource.resource.type}:{" "}
                          {selectedResource.resource.id}
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                        Observed · read only
                      </span>
                    </div>

                    <div className="mt-5">
                      <h5 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                        Resource attributes
                      </h5>

                      {Object.keys(safeAttributes).length === 0 ? (
                        <p className="rounded-lg border border-white/8 bg-black/15 p-4 text-sm text-slate-500">
                          No displayable attributes were returned.
                        </p>
                      ) : (
                        <dl className="grid gap-3 sm:grid-cols-2">
                          {Object.entries(safeAttributes).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="min-w-0 rounded-lg border border-white/[0.07] bg-black/15 p-3"
                              >
                                <dt className="wrap-break-word text-xs text-slate-500">
                                  {key}
                                </dt>
                                <dd className="mt-2 whitespace-pre-wrap wrap-break-word font-mono text-xs leading-5 text-slate-300">
                                  {typeof value === "string"
                                    ? value
                                    : value === undefined
                                      ? "Not specified"
                                      : JSON.stringify(value, null, 2)}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      )}
                    </div>

                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      These attributes reflect the latest saved observation.
                      Observed presence does not establish resource health or
                      configuration correctness.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          <DesiredStatePanel onEvaluationChange={setEvaluation} />

          <PlansChangesPanel evaluation={evaluation} />

          <section
            id="executions"
            className="scroll-mt-6 rounded-xl border border-white/[0.07] bg-[#10131b] p-5"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity size={17} className="text-indigo-400" />
              Execution & verification
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Review the latest execution, its outcome, and whether the
              resulting infrastructure matches the desired state.
            </p>
            <p className="mt-4 text-xs text-slate-600">
              Execution UI — next implementation checkpoint
            </p>
          </section>

          <section
            id="policies"
            className="scroll-mt-6 rounded-xl border border-white/[0.07] bg-[#10131b] p-5"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={17} className="text-indigo-400" />
              Policy and approval controls
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Infrastructure changes remain subject to the existing
              control-plane policy evaluation and approval requirements. This
              dashboard does not bypass either check.
            </p>
          </section>

          {observation && (
            <p className="text-xs text-slate-600">
              Observation ID: {observation.id}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
