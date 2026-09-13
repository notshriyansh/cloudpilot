import { describe, expect, it } from "vitest";
import { diffStates } from "../src/diff";
import {
  filterChangesByScope,
  isManaged,
  type ManagementScope,
} from "../src/scope";
import type { DesiredState, ObservedState } from "../src/state";

describe("management scope", () => {
  it("identifies managed resources", () => {
    const scope: ManagementScope = {
      resources: [
        {
          type: "worker",
          id: "api",
        },
      ],
    };

    expect(
      isManaged(scope, {
        type: "worker",
        id: "api",
      }),
    ).toBe(true);

    expect(
      isManaged(scope, {
        type: "worker",
        id: "other",
      }),
    ).toBe(false);
  });

  it("allows creation of managed resources", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {},
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const scope: ManagementScope = {
      resources: [
        {
          type: "worker",
          id: "api",
        },
      ],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [
        {
          type: "create",
          resource: desired.resources[0],
        },
      ],
    });
  });

  it("allows updates to managed resources", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-25",
          },
        },
      ],
    };

    const scope: ManagementScope = {
      resources: [
        {
          type: "worker",
          id: "api",
        },
      ],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [
        {
          type: "update",
          desired: desired.resources[0],
          observed: observed.resources[0],
        },
      ],
    });
  });

  it("allows deletion of managed resources", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {},
        },
      ],
    };

    const scope: ManagementScope = {
      resources: [
        {
          type: "worker",
          id: "api",
        },
      ],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [
        {
          type: "delete",
          resource: observed.resources[0],
        },
      ],
    });
  });

  it("does not delete unmanaged resources", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "managed-api",
          },
          attributes: {},
        },
        {
          resource: {
            type: "worker",
            id: "unmanaged-api",
          },
          attributes: {},
        },
      ],
    };

    const scope: ManagementScope = {
      resources: [
        {
          type: "worker",
          id: "managed-api",
        },
      ],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [
        {
          type: "delete",
          resource: observed.resources[0],
        },
      ],
    });
  });

  it("does not create an unmanaged desired resource", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "unmanaged-api",
          },
          attributes: {},
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    const scope: ManagementScope = {
      resources: [],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [],
    });
  });

  it("does not update an unmanaged resource", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-25",
          },
        },
      ],
    };

    const scope: ManagementScope = {
      resources: [],
    };

    const diff = diffStates(desired, observed);

    expect(filterChangesByScope(diff, scope)).toEqual({
      changes: [],
    });
  });
});
