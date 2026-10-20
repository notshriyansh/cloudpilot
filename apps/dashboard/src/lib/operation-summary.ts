import type { PlanOperation, ResourceType } from "@cloudpilot/domain";
import { getAttributeChanges } from "./attribute-diff";

const resourceLabels: Record<ResourceType, string> = {
  zone: "zone",
  dns_record: "DNS record",
  worker: "Worker",
  kv_namespace: "KV namespace",
};

function describeResource(type: ResourceType, id: string): string {
  return `${resourceLabels[type]} "${id}"`;
}

function getConfiguredAttributeNames(
  attributes: Record<string, unknown> | undefined,
): string[] {
  return Object.keys(attributes ?? {}).sort();
}

export function buildOperationSummary(operation: PlanOperation): string {
  const resource = describeResource(
    operation.resource.type,
    operation.resource.id,
  );

  switch (operation.action) {
    case "create": {
      const attributes = getConfiguredAttributeNames(
        operation.desired?.attributes,
      );

      if (attributes.length === 0) {
        return `Create ${resource}. No desired attributes are available to summarize.`;
      }

      const preview = attributes.slice(0, 3).join(", ");
      const remaining = attributes.length - 3;
      const attributeSummary =
        remaining > 0 ? `${preview}, and ${remaining} more` : preview;

      return `Create ${resource} with configuration for: ${attributeSummary}.`;
    }

    case "update": {
      if (!operation.observed || !operation.desired) {
        return `Update ${resource}. Complete observed and desired state details are not available for a concise comparison.`;
      }

      const changes = getAttributeChanges(
        operation.observed.attributes,
        operation.desired.attributes,
      ).filter((change) => change.status !== "unchanged");

      if (changes.length === 0) {
        return `Update ${resource}. No attribute differences were detected.`;
      }

      const preview = changes
        .slice(0, 3)
        .map((change) => `${change.key} (${change.status})`);
      const remaining = changes.length - preview.length;
      const changeSummary =
        remaining > 0
          ? `${preview.join(", ")}, and ${remaining} more`
          : preview.join(", ");

      return `Update ${resource}: ${changeSummary}.`;
    }

    case "delete":
      return `Delete ${resource}. This removes the resource from the desired configuration and may affect dependent resources.`;
  }
}
