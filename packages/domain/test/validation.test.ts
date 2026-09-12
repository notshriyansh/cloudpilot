import { describe, expect, it } from "vitest";
import type { DesiredState } from "../src";
import { validateDesiredState } from "../src";

describe("validateDesiredState", () => {
  it("accepts a valid desired state", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: {
            compatibilityDate: "2026-09-12",
          },
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([]);
  });

  it("accepts an empty desired state", () => {
    const state: DesiredState = {
      resources: [],
    };

    expect(validateDesiredState(state)).toEqual([]);
  });

  it("rejects an empty resource ID", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "",
          },
          attributes: {},
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].resource.id",
        message: "resource ID must be a non-empty string",
      },
    ]);
  });

  it("rejects a whitespace-only resource ID", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "   ",
          },
          attributes: {},
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].resource.id",
        message: "resource ID must be a non-empty string",
      },
    ]);
  });

  it("rejects an unsupported resource type", () => {
    const state = {
      resources: [
        {
          resource: {
            type: "r2_bucket",
            id: "assets",
          },
          attributes: {},
        },
      ],
    } as unknown as DesiredState;

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].resource.type",
        message: 'unsupported resource type "r2_bucket"',
      },
    ]);
  });

  it("rejects duplicate resources", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: {},
        },
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: {
            compatibilityDate: "2026-09-12",
          },
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[1].resource",
        message: 'duplicate resource "worker:api-worker"',
      },
    ]);
  });

  it("allows the same ID for different resource types", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {},
        },
        {
          resource: {
            type: "kv_namespace",
            id: "api",
          },
          attributes: {},
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([]);
  });

  it("rejects non-object attributes", () => {
    const state = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: [],
        },
      ],
    } as unknown as DesiredState;

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].attributes",
        message: "attributes must be an object",
      },
    ]);
  });

  it("accepts valid relationships", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {
            name: "www.example.com",
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

    expect(validateDesiredState(state)).toEqual([]);
  });

  it("rejects an unsupported relationship type", () => {
    const state = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {},
          relationships: [
            {
              type: "owns",
              resource: {
                type: "zone",
                id: "zone-1",
              },
            },
          ],
        },
      ],
    } as unknown as DesiredState;

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].relationships[0].type",
        message: 'unsupported relationship type "owns"',
      },
    ]);
  });

  it("rejects an invalid relationship resource type", () => {
    const state = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {},
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "r2_bucket",
                id: "bucket-1",
              },
            },
          ],
        },
      ],
    } as unknown as DesiredState;

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].relationships[0].resource.type",
        message: 'unsupported resource type "r2_bucket"',
      },
    ]);
  });

  it("rejects an empty relationship resource ID", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {},
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "",
              },
            },
          ],
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].relationships[0].resource.id",
        message: "resource ID must be a non-empty string",
      },
    ]);
  });

  it("does not require relationship targets to exist in desired state", () => {
    const state: DesiredState = {
      resources: [
        {
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          attributes: {},
          relationships: [
            {
              type: "belongs_to",
              resource: {
                type: "zone",
                id: "external-zone",
              },
            },
          ],
        },
      ],
    };

    expect(validateDesiredState(state)).toEqual([]);
  });

  it("returns multiple validation errors", () => {
    const state = {
      resources: [
        {
          resource: {
            type: "r2_bucket",
            id: "",
          },
          attributes: [],
        },
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: {},
          relationships: [
            {
              type: "owns",
              resource: {
                type: "r2_bucket",
                id: "",
              },
            },
          ],
        },
        {
          resource: {
            type: "worker",
            id: "api-worker",
          },
          attributes: {},
        },
      ],
    } as unknown as DesiredState;

    expect(validateDesiredState(state)).toEqual([
      {
        path: "resources[0].resource.type",
        message: 'unsupported resource type "r2_bucket"',
      },
      {
        path: "resources[0].resource.id",
        message: "resource ID must be a non-empty string",
      },
      {
        path: "resources[0].attributes",
        message: "attributes must be an object",
      },
      {
        path: "resources[1].relationships[0].type",
        message: 'unsupported relationship type "owns"',
      },
      {
        path: "resources[1].relationships[0].resource.type",
        message: 'unsupported resource type "r2_bucket"',
      },
      {
        path: "resources[1].relationships[0].resource.id",
        message: "resource ID must be a non-empty string",
      },
      {
        path: "resources[2].resource",
        message: 'duplicate resource "worker:api-worker"',
      },
    ]);
  });
});
