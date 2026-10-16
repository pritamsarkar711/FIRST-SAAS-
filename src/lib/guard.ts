import { lookup } from "dns/promises";

const PRIVATE_V4 = [
  { ip: "0.0.0.0", bits: 8 },
  { ip: "10.0.0.0", bits: 8 },
  { ip: "100.64.0.0", bits: 10 },
  { ip: "127.0.0.0", bits: 8 },
  { ip: "169.254.0.0", bits: 16 },
  { ip: "172.16.0.0", bits: 12 },
  { ip: "192.168.0.0", bits: 16 },
  { ip: "192.0.0.0", bits: 24 },
  { ip: "198.18.0.0", bits: 15 },
  { ip: "224.0.0.0", bits: 4 },
  { ip: "240.0.0.0", bits: 4 },
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isPrivateV4(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true;
  return PRIVATE_V4.some(({ ip: net, bits }) => {
    const base = v4ToInt(net)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const l = ip.toLowerCase();
  if (l === "::" || l === "::1") return true;
  if (l.startsWith("fe80") || l.startsWith("fc") || l.startsWith("fd")) return true;
  if (l.startsWith("::ffff:")) return isPrivateV4(l.replace("::ffff:", ""));
  return false;
}

export interface SafeUrlResult { url: URL; hostname: string }

/** Validates a user-supplied URL is a public http(s) address. Blocks SSRF targets. */
export async function assertPublicUrl(input: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(input.trim().includes("://") ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https URLs are allowed");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Non-standard ports are not allowed");
  if (url.username || url.password) throw new Error("Credentials in URL are not allowed");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local addresses are not allowed");
  }
  // Literal IPs
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateV4(hostname)) throw new Error("Private addresses are not allowed");
    return { url, hostname };
  }
  if (hostname.includes(":")) {
    if (isPrivateV6(hostname)) throw new Error("Private addresses are not allowed");
    return { url, hostname };
  }
  // Domain: must resolve to public addresses
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("This domain does not resolve. Check the spelling or register it first.");
  }
  if (!addresses.length) throw new Error("This domain does not resolve");
  for (const a of addresses) {
    if (a.family === 4 ? isPrivateV4(a.address) : isPrivateV6(a.address)) {
      throw new Error("Private addresses are not allowed");
    }
  }
  return { url, hostname };
}

export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0].split("#")[0];
  return d;
}
