import { promises as dns } from "node:dns";
import net from "node:net";

const DEFAULT_ALLOWED_HOSTS = [
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "nie.lk",
  "www.nie.lk",
  "pastpapers.wiki",
  "www.pastpapers.wiki",
];

function configuredHosts() {
  return String(process.env.PDF_PROXY_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function allowedHost(host: string) {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  const allowlist = [...DEFAULT_ALLOWED_HOSTS, ...configuredHosts()];
  return allowlist.some((entry) => normalized === entry || normalized.endsWith(`.${entry}`));
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isPrivateAddress(address: string) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1"
      || normalized === "::"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe8")
      || normalized.startsWith("fe9")
      || normalized.startsWith("fea")
      || normalized.startsWith("feb")
      || normalized.startsWith("::ffff:127.")
      || normalized.startsWith("::ffff:10.")
      || normalized.startsWith("::ffff:192.168.");
  }
  return true;
}

export async function validateRemotePdfUrl(value: unknown) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error("PDF_PROXY_HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("PDF_PROXY_CREDENTIALS_FORBIDDEN");
  if (url.port && url.port !== "443") throw new Error("PDF_PROXY_PORT_FORBIDDEN");
  if (!allowedHost(url.hostname)) throw new Error("PDF_PROXY_HOST_NOT_ALLOWED");

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("PDF_PROXY_PRIVATE_ADDRESS_FORBIDDEN");
  }
  return url;
}

export async function readResponseWithLimit(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("PDF_PROXY_FILE_TOO_LARGE");
  if (!response.body) throw new Error("PDF_PROXY_EMPTY_BODY");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("PDF_PROXY_FILE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const output = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    Buffer.from(chunk).copy(output, offset);
    offset += chunk.byteLength;
  }
  if (output.length < 5 || output.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("PDF_PROXY_INVALID_SIGNATURE");
  }
  return output;
}
