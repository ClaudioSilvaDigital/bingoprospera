
export function normalizeBaseUrl(raw?: string): string {
  if (!raw) return 'http://localhost:10000';
  const v = String(raw).trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  // it's a host or host:port -> assume HTTPS in production
  if (typeof window !== 'undefined') {
    const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.');
    const scheme = isLocal ? 'http' : 'https';
    return `${scheme}://${v}`;
  }
  return `https://${v}`;
}
export function toWsUrl(base: string): string {
  const u = new URL(normalizeBaseUrl(base));
  u.protocol = (u.protocol === 'https:') ? 'wss:' : 'ws:';
  return u.toString();
}
