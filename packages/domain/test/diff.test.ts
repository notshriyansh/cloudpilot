import { describe, expect, it } from "vitest";

import { diffStates } from "../src";
import type { DesiredState, ObservedState } from "../src";

describe("diffStates", () => {
  it("returns no changes when desired and observed state match", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [],
    });
  });

  it("ignores object key ordering when comparing attributes", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            settings: {
              enabled: true,
              retries: 3,
            },
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            settings: {
              retries: 3,
              enabled: true,
            },
            name: "example.com",
          },
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [],
    });
  });

  it("detects resources that need to be created", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [
        {
          type: "create",
          resource: desired.resources[0],
        },
      ],
    });
  });

  it("detects relationship changes as updates", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-2",
              },
            },
          ],
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
            type: "A",
            content: "203.0.113.10",
            ttl: 300,
            proxied: true,
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [
        {
          type: "update",
          desired: desired.resources[0],
          observed: observed.resources[0],
        },
      ],
    });
  });

  it("ignores relationship ordering", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-2",
              },
            },
          ],
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "api.example.com",
          },
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-2",
              },
            },
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [],
    });
  });

  it("detects resources that need to be updated", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "pending",
          },
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [
        {
          type: "update",
          desired: desired.resources[0],
          observed: observed.resources[0],
        },
      ],
    });
  });

  it("detects resources that should be deleted", () => {
    const desired: DesiredState = {
      resources: [],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "example.com",
            status: "active",
          },
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [
        {
          type: "delete",
          resource: observed.resources[0],
        },
      ],
    });
  });

  it("handles creates, updates, and deletes together", () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "updated.example.com",
            status: "active",
          },
        },
        {
          resource: {
            type: "zone",
            id: "zone-2",
          },
          attributes: {
            name: "new.example.com",
            status: "active",
          },
        },
      ],
    };

    const observed: ObservedState = {
      resources: [
        {
          resource: {
            type: "zone",
            id: "zone-1",
          },
          attributes: {
            name: "old.example.com",
            status: "active",
          },
        },
        {
          resource: {
            type: "zone",
            id: "zone-3",
          },
          attributes: {
            name: "removed.example.com",
            status: "active",
          },
        },
      ],
    };

    expect(diffStates(desired, observed)).toEqual({
      changes: [
        {
          type: "update",
          desired: desired.resources[0],
          observed: observed.resources[0],
        },
        {
          type: "create",
          resource: desired.resources[1],
        },
        {
          type: "delete",
          resource: observed.resources[1],
        },
      ],
    });
  });
});
