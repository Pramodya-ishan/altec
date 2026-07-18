import { readFile } from "node:fs/promises";
import { isVertexAiEnabled } from "../ai/client";
import { storageGsUri } from "./sourceBuffer";

export type SftReferenceDomain = "physics" | "chemistry" | "biology" | "mathematics" | "general";

export type SftGroundingReference = {
  id: string;
  title: string;
  domain: SftReferenceDomain;
  storagePath: string;
  envName: string;
  bundledName: string;
};

const REFERENCES: SftGroundingReference[] = [
  {
    id: "sft_physics_reference",
    title: "SFT Physics Book 2",
    domain: "physics",
    envName: "SFT_PHYSICS_REFERENCE_STORAGE_PATH",
    storagePath: "users/7kUEmzikv8hat7KQg8pCNGR1ZUd2/past_papers/SFT/model_paper/2026/7ee4951d-1399-45ff-ab72-ad72b7dde71c/SFT_Physics_book2.pdf",
    bundledName: "SFT Physics book2.pdf",
  },
  {
    id: "sft_biology_reference",
    title: "SFT Biology Book",
    domain: "biology",
    envName: "SFT_BIOLOGY_REFERENCE_STORAGE_PATH",
    storagePath: "users/7kUEmzikv8hat7KQg8pCNGR1ZUd2/past_papers/SFT/model_paper/2026/b7718075-2348-442b-bc5f-cdc80bb6b3e0/SFT_Bio_Book.pdf",
    bundledName: "SFT Bio Book.pdf",
  },
  {
    id: "sft_chemistry_reference",
    title: "SFT Chemistry Book 1",
    domain: "chemistry",
    envName: "SFT_CHEMISTRY_REFERENCE_STORAGE_PATH",
    storagePath: "users/7kUEmzikv8hat7KQg8pCNGR1ZUd2/past_papers/SFT/model_paper/2026/8da3857e-e026-4b6f-8427-3d1aa6dbe614/SFT_Chemistry_Book_1.pdf",
    bundledName: "SFT Chemistry Book 1.pdf",
  },
  {
    id: "sft_mathematics_reference",
    title: "SFT Mathematics Book 1",
    domain: "mathematics",
    envName: "SFT_MATHEMATICS_REFERENCE_STORAGE_PATH",
    storagePath: "",
    bundledName: "SFT Maths book 1.pdf",
  },
  {
    id: "sft_grade12_reference",
    title: "Grade 12 SFT Resource Book",
    domain: "general",
    envName: "SFT_GRADE12_REFERENCE_STORAGE_PATH",
    storagePath: "",
    bundledName: "sGr12OM SFT ResourceBookNew.pdf",
  },
];

const DOMAIN_PATTERNS: Array<[SftReferenceDomain, RegExp]> = [
  ["chemistry", /NaOH|H₂SO₄|H2SO4|acid|base|reaction|enthalpy|heat of|polymer|chemical|රසායන|අම්ල|භෂ්ම|ප්‍රතික්‍රියා|ප්රතික්රියා|තාප රසායන|බහුඅවයවික/u],
  ["biology", /cell|microorgan|plant|animal|biology|enzyme|forest|tissue|seed|සෛල|ක්ෂුද්‍ර|ශාක|ජීව|පටක|බීජ|වනාන්තර/u],
  ["physics", /force|motion|energy|electric|current|heat|fluid|pressure|measurement|බලය|චලිත|ශක්තිය|විද්‍යුත|විදුලි|තරල|පීඩන|තාපය|මිනුම්/u],
  ["mathematics", /triangle|area|volume|statistics|coordinate|trigon|mean|median|math|ත්‍රිකෝණ|වර්ගඵල|පරිමාව|සංඛ්‍යාන|ඛණ්ඩාංක|මධ්‍යන්‍ය|ගණිත/u],
];

export function inferSftReferenceDomains(text: unknown): SftReferenceDomain[] {
  const value = String(text || "").normalize("NFC");
  const matches = DOMAIN_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(([domain]) => domain);
  return matches.length > 0 ? [...new Set(matches)].slice(0, 2) : ["general"];
}

async function loadBundled(reference: SftGroundingReference) {
  const runtimeBase = (globalThis as any).__ALTEC_RUNTIME_URL__ || import.meta.url;
  const encodedName = reference.bundledName.split("/").map(encodeURIComponent).join("/");
  const candidates = [
    new URL(`./authoritative/sft/${encodedName}`, runtimeBase),
    new URL(`../../assets/authoritative/sft/${encodedName}`, import.meta.url),
    new URL(`../../seed/sft-reference-library/${encodedName}`, import.meta.url),
  ];
  for (const url of candidates) {
    try {
      const buffer = await readFile(url);
      if (buffer.length > 10_000 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return buffer;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

export async function getSftReferenceGroundingParts(query: string) {
  const domains = inferSftReferenceDomains(query);
  const selected = REFERENCES.filter((reference) => domains.includes(reference.domain))
    .concat(REFERENCES.filter((reference) => reference.domain === "general"))
    .filter((reference, index, array) => array.findIndex((item) => item.id === reference.id) === index)
    .slice(0, 2);

  const parts: any[] = [];
  const sources: Array<{ id: string; title: string; domain: SftReferenceDomain; method: string }> = [];
  for (const reference of selected) {
    const configuredPath = String(process.env[reference.envName] || reference.storagePath || "").trim();
    const gcsUri = configuredPath && isVertexAiEnabled() ? storageGsUri(configuredPath) : "";
    if (gcsUri) {
      parts.push({ fileData: { fileUri: gcsUri, mimeType: "application/pdf" } });
      sources.push({ id: reference.id, title: reference.title, domain: reference.domain, method: "vertex_gcs_uri" });
      continue;
    }

    const buffer = await loadBundled(reference);
    if (buffer) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } });
      sources.push({ id: reference.id, title: reference.title, domain: reference.domain, method: "bundled_authoritative_pdf" });
    }
  }
  return { parts, sources, domains };
}
