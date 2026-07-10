/**
 * Recursively removes undefined values from an object or array.
 * Useful for Firestore which rejects undefined properties.
 */
export function removeUndefinedDeep(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        result[key] = removeUndefinedDeep(value);
      }
    }
  }
  return result;
}

export function sanitizeSource(source: any): any {
  if (!source) return null;
  const sanitized = { ...source };
  
  // Explicitly ensure URL is not undefined
  if (sanitized.url === undefined) {
    sanitized.url = null;
  }
  
  return removeUndefinedDeep(sanitized);
}
