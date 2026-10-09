import type { CloudflareApiError } from "./errors";
import { CloudflareProviderError } from "./errors";

const API_BASE_URL = "https://api.cloudflare.com/client/v4";

export interface CloudflareApiResponse<T> {
  result: T;
  resultInfo?: {
    page: number;
    perPage: number;
    totalPages: number;
    total: number;
  };
}

export interface CloudflareApiClient {
  request<T>(path: string): Promise<CloudflareApiResponse<T>>;

  getText(path: string): Promise<string>;

  putMultipart<T>(
    path: string,
    formData: FormData,
  ): Promise<CloudflareApiResponse<T>>;

  delete<T>(path: string): Promise<CloudflareApiResponse<T>>;
}

function parseCloudflareErrors(body: unknown): CloudflareApiError[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("errors" in body) ||
    !Array.isArray(body.errors)
  ) {
    return [];
  }

  return body.errors.filter(
    (error): error is CloudflareApiError =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "number" &&
      "message" in error &&
      typeof error.message === "string",
  );
}

function parseResultInfo(
  body: object,
): CloudflareApiResponse<unknown>["resultInfo"] {
  if (
    !("result_info" in body) ||
    typeof body.result_info !== "object" ||
    body.result_info === null
  ) {
    return undefined;
  }

  const resultInfo = body.result_info;

  if (
    !("page" in resultInfo) ||
    typeof resultInfo.page !== "number" ||
    !("per_page" in resultInfo) ||
    typeof resultInfo.per_page !== "number" ||
    !("total_pages" in resultInfo) ||
    typeof resultInfo.total_pages !== "number" ||
    !("total" in resultInfo) ||
    typeof resultInfo.total !== "number"
  ) {
    return undefined;
  }

  return {
    page: resultInfo.page,
    perPage: resultInfo.per_page,
    totalPages: resultInfo.total_pages,
    total: resultInfo.total,
  };
}

export function createCloudflareApiClient(
  apiToken: string,
  fetchImpl: typeof fetch = fetch,
): CloudflareApiClient {
  async function request<T>(
    path: string,
    init: RequestInit,
  ): Promise<CloudflareApiResponse<T>> {
    const response = await fetchImpl(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        ...init.headers,
      },
    });

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new CloudflareProviderError(
        `Cloudflare API returned an invalid response with status ${response.status}`,
        response.status,
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("success" in body) ||
      typeof body.success !== "boolean"
    ) {
      throw new CloudflareProviderError(
        "Cloudflare API returned an invalid response",
        response.status,
      );
    }

    if (!body.success) {
      const errors = parseCloudflareErrors(body);
      const firstError = errors[0];

      throw new CloudflareProviderError(
        firstError?.message ??
          `Cloudflare API request failed with status ${response.status}`,
        response.status,
        firstError?.code,
      );
    }

    if (!("result" in body)) {
      throw new CloudflareProviderError(
        "Cloudflare API returned an invalid response",
        response.status,
      );
    }

    return {
      result: body.result as T,
      resultInfo: parseResultInfo(body),
    };
  }

  return {
    request<T>(path: string): Promise<CloudflareApiResponse<T>> {
      return request<T>(path, {
        method: "GET",
      });
    },

    getText(path: string): Promise<string> {
      return (async () => {
        const response = await fetchImpl(`${API_BASE_URL}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: "*/*",
          },
        });

        if (!response.ok) {
          let body: unknown;

          try {
            body = await response.clone().json();
          } catch {
            throw new CloudflareProviderError(
              `Cloudflare API returned an invalid response with status ${response.status}`,
              response.status,
            );
          }

          if (
            typeof body === "object" &&
            body !== null &&
            "success" in body &&
            body.success === false
          ) {
            const firstError = parseCloudflareErrors(body)[0];

            throw new CloudflareProviderError(
              firstError?.message ??
                `Cloudflare API request failed with status ${response.status}`,
              response.status,
              firstError?.code,
            );
          }

          throw new CloudflareProviderError(
            `Cloudflare API returned an invalid response with status ${response.status}`,
            response.status,
          );
        }

        return response.text();
      })();
    },

    putMultipart<T>(
      path: string,
      formData: FormData,
    ): Promise<CloudflareApiResponse<T>> {
      return request<T>(path, {
        method: "PUT",
        body: formData,
      });
    },

    delete<T>(path: string): Promise<CloudflareApiResponse<T>> {
      return request<T>(path, {
        method: "DELETE",
      });
    },
  };
}
