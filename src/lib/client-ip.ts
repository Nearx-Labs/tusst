import { isIP } from "node:net";

export const MAX_TRUSTED_PROXY_HOPS = 10;
export const SHARED_ANON_KEY = "ip:unknown";

export interface ClientIpConfig {
  onVercel: boolean;
  trustedProxyHops: number;
}

export type ClientIpEnv = Readonly<Record<string, string | undefined>>;

interface HeaderReader {
  get(name: string): string | null;
}

export function parseTrustedProxyHops(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const value = raw.trim();
  if (!/^\d{1,2}$/.test(value)) return 0;
  const hops = Number(value);
  return hops <= MAX_TRUSTED_PROXY_HOPS ? hops : 0;
}

export function clientIpConfigFromEnv(env: ClientIpEnv): ClientIpConfig {
  return {
    onVercel: Boolean(env.VERCEL),
    trustedProxyHops: parseTrustedProxyHops(env.TRUSTED_PROXY_HOPS),
  };
}

function stripPort(value: string): { host: string; bracketed: boolean } {
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(value);
  if (bracketed) return { host: bracketed[1], bracketed: true };
  const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(value);
  if (v4WithPort) return { host: v4WithPort[1], bracketed: false };
  return { host: value, bracketed: false };
}

function ipv6Groups(address: string): number[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    const pieces = part.split(":");
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (piece.includes(".")) {
        if (i !== pieces.length - 1 || isIP(piece) !== 4) return null;
        const octets = piece.split(".").map(Number);
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
        groups.push(parseInt(piece, 16));
      }
    }
    return groups;
  };
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

function formatIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < groups.length; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === 0) j++;
    if (j - i > bestLength) {
      bestStart = i;
      bestLength = j - i;
    }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (bestLength < 2) return hex.join(":");
  const left = hex.slice(0, bestStart).join(":");
  const right = hex.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`;
}

export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const { host, bracketed } = stripPort(raw.trim());
  const zone = host.indexOf("%");
  const value = zone === -1 ? host : host.slice(0, zone);
  const family = isIP(value);
  if (family === 4 && !bracketed) return value;
  if (family !== 6) return null;
  const groups = ipv6Groups(value);
  if (!groups) return null;
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${formatIpv6([...groups.slice(0, 4), 0, 0, 0, 0])}/64`;
}

function rightmost(list: string): string | undefined {
  const entries = list.split(",");
  return entries[entries.length - 1]?.trim();
}

function presentHeader(headers: HeaderReader, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim() !== "" ? value : null;
}

export function resolveClientIp(headers: HeaderReader, config: ClientIpConfig): string | null {
  if (config.onVercel) {
    const platform =
      presentHeader(headers, "x-vercel-forwarded-for") ?? presentHeader(headers, "x-real-ip");
    return platform ? normalizeClientIp(rightmost(platform)) : null;
  }
  const hops = config.trustedProxyHops;
  if (!Number.isInteger(hops) || hops < 1 || hops > MAX_TRUSTED_PROXY_HOPS) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const entries = forwarded.split(",");
  if (entries.length < hops) return null;
  return normalizeClientIp(entries[entries.length - hops]);
}

export function clientKeyFromHeaders(
  headers: HeaderReader,
  userId: string | null,
  config: ClientIpConfig,
): string {
  if (userId) return `user:${userId}`;
  const ip = resolveClientIp(headers, config);
  return ip ? `ip:${ip}` : SHARED_ANON_KEY;
}
