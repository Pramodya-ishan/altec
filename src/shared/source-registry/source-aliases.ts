import { normalizeFileName, normalizeSubject } from "./source-normalization";
import { SourceRecord } from "./source.types";

/**
 * Generates deterministic aliases for a source record to improve search discovery.
 */
export function generateSourceAliases(input: Partial<SourceRecord>): string[] {
  const aliases = new Set<string>();

  // 1. Add original filename if present
  if (input.originalFileName) {
    aliases.add(input.originalFileName);
    const normalized = normalizeFileName(input.originalFileName);
    aliases.add(normalized.normalizedName);
    aliases.add(normalized.normalizedStem);
  }

  // 2. Add display title
  if (input.displayTitle) {
    const titleNorm = normalizeFileName(input.displayTitle);
    aliases.add(input.displayTitle);
    aliases.add(titleNorm.normalizedName);
    aliases.add(titleNorm.normalizedStem);
  }

  // 3. Add academic metadata aliases
  const subject = input.subject;
  const year = input.year;
  const role = input.resourceRole;
  const part = input.paperPart;

  if (subject && year) {
    const subCode = normalizeSubject(subject) || subject;
    const baseAlias = `${year} ${subCode}`.toLowerCase();
    aliases.add(baseAlias);
    
    if (role) {
      const roleAlias = `${baseAlias} ${role.replace("_", " ")}`.toLowerCase();
      aliases.add(roleAlias);
      
      if (part) {
        aliases.add(`${roleAlias} ${part}`.toLowerCase());
      }
    }
  }

  // 4. Add Paper Part aliases
  if (part) {
    const p = part.toLowerCase();
    if (p === "1" || p === "i") {
      aliases.add("paper 1");
      aliases.add("paper i");
      aliases.add("mcq");
    } else if (p === "2" || p === "ii") {
      aliases.add("paper 2");
      aliases.add("paper ii");
      aliases.add("structured");
      aliases.add("essay");
    }
  }

  // 5. Common resource type aliases
  if (role === "marking_scheme") {
    aliases.add("answers");
    aliases.add("marking scheme");
    aliases.add("scheme");
  } else if (role === "past_paper") {
    aliases.add("past paper");
    aliases.add("question paper");
  }

  // Filter out empty strings and deduplicate (Set handles deduplication)
  // Trim and limit counts
  return Array.from(aliases)
    .map(a => a.trim().toLowerCase())
    .filter(a => a.length > 0)
    .slice(0, 50);
}
