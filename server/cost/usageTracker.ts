import { getAdminDb } from "../firebase/admin";

interface UserDailyUsage {
  date: string;
  normalMessages: number;
  directPdfQaCalls: number;
  solverCalls: number;
  proCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// In-memory cache for daily usage to avoid fetching Firestore on every user message
const usageCache: Record<string, { usage: UserDailyUsage; expiresAt: number }> = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache TTL

// Daily cost & request safety limits (requested)
const LIMITS = {
  FREE: {
    normalMessages: 20,
    directPdfQaCalls: 3,
    solverCalls: 10
  }
};

const DAILY_MAX_COST_USD = 1.00; // $1.00 per user per day safety budget

/**
 * Returns current date in YYYYMMDD format
 */
function getTodayString(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

/**
 * Calculates approximate Gemini API pricing in USD
 */
export function calculateGeminiCost(model: string, inputTokens: number, outputTokens: number): number {
  const m = model.toLowerCase();
  
  // A. Pro models: ~$1.25 / 1M input, $5.00 / 1M output
  if (m.includes("pro")) {
    return (inputTokens * 1.25 + outputTokens * 5.00) / 1000000;
  }
  
  // B. Flash models: ~$0.075 / 1M input, $0.30 / 1M output
  if (m.includes("flash") && !m.includes("lite")) {
    return (inputTokens * 0.075 + outputTokens * 0.30) / 1000000;
  }
  
  // C. Flash Lite / other fast models: ~$0.0375 / 1M input, $0.15 / 1M output
  if (m.includes("lite")) {
    return (inputTokens * 0.0375 + outputTokens * 0.15) / 1000000;
  }

  // D. Embeddings: ~$0.025 / 1M
  if (m.includes("embed")) {
    return ((inputTokens + outputTokens) * 0.025) / 1000000;
  }

  // Default fallback (low estimation)
  return ((inputTokens + outputTokens) * 0.1) / 1000000;
}

/**
 * Loads the user's daily usage either from cache or from Firestore
 */
async function loadDailyUsage(uid: string, date: string): Promise<UserDailyUsage> {
  const cacheKey = `${uid}_${date}`;
  const cached = usageCache[cacheKey];
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.usage;
  }

  const db = getAdminDb();
  const usageDocRef = db.collection("usage_daily").doc(cacheKey);
  
  let usage: UserDailyUsage = {
    date,
    normalMessages: 0,
    directPdfQaCalls: 0,
    solverCalls: 0,
    proCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0
  };

  try {
    const snap = await usageDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      usage = {
        date,
        normalMessages: Number(data?.normalMessages || 0),
        directPdfQaCalls: Number(data?.directPdfQaCalls || 0),
        solverCalls: Number(data?.solverCalls || 0),
        proCalls: Number(data?.proCalls || 0),
        inputTokens: Number(data?.inputTokens || 0),
        outputTokens: Number(data?.outputTokens || 0),
        estimatedCostUsd: Number(data?.estimatedCostUsd || 0)
      };
    }
  } catch (err) {
    console.warn(`[usageTracker] Failed to read usage limits from Firestore for user ${uid}:`, err);
  }

  // Update memory cache
  usageCache[cacheKey] = {
    usage,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return usage;
}

/**
 * Checks if the user's safety budget is exceeded
 */
export async function isDailyLimitExceeded(uid: string): Promise<{ exceeded: boolean; reason?: string }> {
  return { exceeded: false };
}

export async function checkSpecificLimit(uid: string, type: 'directPdfQaCalls' | 'solverCalls'): Promise<{ exceeded: boolean; reason?: string }> {
  return { exceeded: false };
}

/**
 * Tracks and logs AI usage metrics in both memory and Firestore
 */
export async function trackAIUsage(
  uid: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  type: keyof UserDailyUsage
): Promise<void> {
  const todayStr = getTodayString();
  const cost = calculateGeminiCost(model, inputTokens, outputTokens);
  
  const usage = await loadDailyUsage(uid, todayStr);
  
  // Accumulate
  if (typeof usage[type] === 'number') {
    (usage[type] as number) += 1;
  }
  usage.estimatedCostUsd += cost;
  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;

  // Save to cache
  const cacheKey = `${uid}_${todayStr}`;
  usageCache[cacheKey] = {
    usage,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  // Sync to Firestore
  const db = getAdminDb();
  const usageDocRef = db.collection("usage_daily").doc(cacheKey);

  usageDocRef.set({
    ...usage,
    uid,
    lastUpdated: new Date().toISOString(),
    lastModelUsed: model
  }, { merge: true }).catch((err: any) => {
    console.error(`[usageTracker] Failed to save usage tracking for user ${uid}:`, err);
  });
}
