export interface CloudflareDnsRecord {
  id: string;
  zoneId: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
}
