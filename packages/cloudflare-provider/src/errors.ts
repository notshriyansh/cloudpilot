export class CloudflareProviderError extends Error {
  readonly status: number;
  readonly code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "CloudflareProviderError";
    this.status = status;
    this.code = code;
  }
}
