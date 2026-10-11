import {
  resourceIdKey,
  type DesiredState,
  type ObservedState,
  type ResourceState,
} from "@cloudpilot/domain";

export type WorkerScriptReader = (scriptName: string) => Promise<string>;

export async function findWorkerScriptDrift(
  desired: DesiredState,
  observed: ObservedState,
  readWorkerScript: WorkerScriptReader,
): Promise<Set<string>> {
  const observedKeys = new Set(
    observed.resources.map((resource) => resourceIdKey(resource.resource)),
  );
  const driftedKeys = new Set<string>();

  for (const resource of desired.resources) {
    if (resource.resource.type !== "worker") {
      continue;
    }

    const desiredScript = resource.attributes.script;

    if (
      typeof desiredScript !== "string" ||
      !observedKeys.has(resourceIdKey(resource.resource))
    ) {
      continue;
    }

    const deployedScript = await readWorkerScript(resource.resource.id);

    if (deployedScript !== desiredScript) {
      driftedKeys.add(resourceIdKey(resource.resource));
    }
  }

  return driftedKeys;
}

export function withoutWorkerScripts(state: ObservedState): ObservedState {
  return {
    resources: state.resources.map((resource) => {
      if (resource.resource.type !== "worker") {
        return resource;
      }

      const attributes = Object.fromEntries(
        Object.entries(resource.attributes).filter(([key]) => key !== "script"),
      );

      return { ...resource, attributes };
    }),
  };
}

export function markWorkerScriptDrift(
  state: ObservedState,
  driftedKeys: ReadonlySet<string>,
): ObservedState {
  return {
    resources: state.resources.map((resource): ResourceState => {
      if (
        resource.resource.type !== "worker" ||
        !driftedKeys.has(resourceIdKey(resource.resource))
      ) {
        return resource;
      }

      return {
        ...resource,
        attributes: {
          ...resource.attributes,
          script: { cloudPilot: "deployed-script-differs" },
        },
      };
    }),
  };
}
