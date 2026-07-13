export function scoreSource(source: any, request: {
  subject?: string;
  year?: string;
  resourceType?: string;
  paperType?: string;
  keywords?: string[];
  ownerUid?: string;
}): number {
  let score = 0;

  if (request.subject && source.subject === request.subject) score += 40;
  else if (request.subject && source.subject !== request.subject) score -= 50;

  if (request.year && source.year === request.year) score += 30;
  else if (request.year && source.year && source.year !== request.year) score -= 40;

  if (request.resourceType && source.resourceType === request.resourceType) score += 25;
  else if (request.resourceType && source.resourceType && source.resourceType !== request.resourceType) score -= 40;

  if (request.paperType && source.paperType === request.paperType) score += 20;

  if (request.keywords && request.keywords.length > 0 && source.title) {
    const titleLower = source.title.toLowerCase();
    for (const kw of request.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
         score += 15;
      }
    }
  }

  if (request.ownerUid && source.ownerUid === request.ownerUid) score += 10;

  if (!source.storagePath && !source.url) score -= 30;

  if (source.sourceScope === "irrelevant") score -= 30;

  return score;
}
