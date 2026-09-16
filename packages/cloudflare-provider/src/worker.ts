export interface CloudflareWorker {
  id: string;
  createdAt?: string;
  modifiedAt?: string;
  compatibilityDate?: string;
}

export interface CloudflareWorkerDeployment {
  script: string;
  compatibilityDate?: string;
}
