import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'docs', 'REQUESTED_300_FEATURES.txt');
const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
const categoryMap = {
  'AI සහ learning features — 1–150': 'ai_learning',
  'Authentication, data සහ profiles — 151–180': 'auth_data',
  'Performance සහ reliability — 181–220': 'performance_reliability',
  'UI/UX සහ responsive design — 221–260': 'ui_ux',
  'Files, PDFs සහ video — 261–280': 'files_media',
  'Security, DevOps, SEO සහ quality — 281–300': 'security_quality',
};

let category = '';
const parsed = [];
for (const rawLine of lines) {
  if (rawLine.startsWith('## ')) category = rawLine.slice(3).trim();
  const match = rawLine.trim().match(/^(\d+)\.\s*(.+)$/);
  if (!match) continue;
  parsed.push({ id: Number(match[1]), category: categoryMap[category], title: match[2].trim() });
}

if (parsed.length !== 300 || new Set(parsed.map((feature) => feature.id)).size !== 300) {
  throw new Error(`Expected 300 unique features, received ${parsed.length}`);
}

const available = new Set([
  1,2,3,4,5,7,8,9,11,14,17,20,21,22,27,28,30,34,39,40,41,42,43,44,45,48,49,50,
  51,53,54,55,71,73,91,96,99,116,117,132,133,134,135,136,137,138,139,140,
  151,152,153,154,156,157,158,159,163,164,165,166,171,172,173,174,176,177,
  181,183,184,185,186,187,192,195,196,197,198,199,200,201,202,203,204,207,208,209,210,214,216,
  ...Array.from({ length: 19 }, (_, index) => 221 + index),
  241,242,
  ...Array.from({ length: 17 }, (_, index) => 244 + index),
  ...Array.from({ length: 20 }, (_, index) => 261 + index),
  282,283,285,286,287,288,290,292,294,295,296,
]);

const planned = new Set([
  32,33,46,47,105,106,107,108,114,115,118,119,120,121,122,123,124,
  141,142,143,144,145,146,147,148,149,150,
  160,161,162,168,169,170,175,178,179,180,
  188,189,190,191,193,194,211,212,213,215,217,218,219,220,
  240,243,281,289,291,293,297,298,299,300,
]);

const refsByCategory = {
  ai_learning: ['server/ai-core', 'server/knowledge', 'server/pdf', 'server/learning', 'src/components/views/CloraXView.tsx'],
  auth_data: ['server/auth', 'server/firebase', 'server/utils/authGuards.ts', 'src/context/AppContext.tsx'],
  performance_reliability: ['src/lib/api.ts', 'server/utils/retry.ts', 'server/ai/aiCircuitBreaker.ts', 'server/pdf/processingPipeline.ts'],
  ui_ux: ['src/App.tsx', 'src/styles/clora-design.css', 'src/components/ui', 'src/pages/FeatureCenter.tsx'],
  files_media: ['server/pdf', 'server/video', 'src/components/video/SecureVideoPlayer.tsx', 'src/components/views/SyllabusLibraryView.tsx'],
  security_quality: ['server.ts', 'server/utils', 'firestore.rules', 'scripts', 'docs/security'],
};

const features = parsed.map((feature) => {
  const state = available.has(feature.id) ? 'available' : planned.has(feature.id) ? 'planned' : 'foundation';
  return {
    ...feature,
    key: `feature_${String(feature.id).padStart(3, '0')}`,
    state,
    priority: feature.id <= 50 || (feature.id >= 151 && feature.id <= 180) || feature.id >= 281 ? 'high' : feature.id <= 220 ? 'medium' : 'normal',
    defaultEnabled: state !== 'planned',
    implementationRefs: refsByCategory[feature.category],
  };
});

const header = `export type FeatureCategory =\n  | "ai_learning"\n  | "auth_data"\n  | "performance_reliability"\n  | "ui_ux"\n  | "files_media"\n  | "security_quality";\n\nexport type FeatureDeliveryState = "available" | "foundation" | "planned";\nexport type FeaturePriority = "high" | "medium" | "normal";\n\nexport interface PlatformFeature {\n  id: number;\n  key: string;\n  category: FeatureCategory;\n  title: string;\n  state: FeatureDeliveryState;\n  priority: FeaturePriority;\n  defaultEnabled: boolean;\n  implementationRefs: string[];\n}\n\nexport const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {\n  ai_learning: "AI සහ learning",\n  auth_data: "Authentication, data සහ profiles",\n  performance_reliability: "Performance සහ reliability",\n  ui_ux: "UI/UX සහ responsive design",\n  files_media: "Files, PDFs සහ video",\n  security_quality: "Security, DevOps, SEO සහ quality",\n};\n\n`;
const footer = `\n\nexport function getFeatureById(id: number): PlatformFeature | undefined {\n  return PLATFORM_FEATURES.find((feature) => feature.id === id);\n}\n\nexport function summarizeFeatureCatalog(features: PlatformFeature[] = PLATFORM_FEATURES) {\n  const byState: Record<FeatureDeliveryState, number> = { available: 0, foundation: 0, planned: 0 };\n  const byCategory = Object.fromEntries(\n    Object.keys(FEATURE_CATEGORY_LABELS).map((category) => [category, { total: 0, available: 0, foundation: 0, planned: 0 }]),\n  ) as Record<FeatureCategory, { total: number; available: number; foundation: number; planned: number }>;\n\n  for (const feature of features) {\n    byState[feature.state] += 1;\n    byCategory[feature.category].total += 1;\n    byCategory[feature.category][feature.state] += 1;\n  }\n\n  return {\n    total: features.length,\n    byState,\n    byCategory,\n    productionReadyPercent: Math.round((byState.available / Math.max(features.length, 1)) * 100),\n    integratedPercent: Math.round(((byState.available + byState.foundation) / Math.max(features.length, 1)) * 100),\n  };\n}\n`;

fs.mkdirSync(path.join(root, 'shared', 'platform'), { recursive: true });
fs.writeFileSync(path.join(root, 'shared', 'platform', 'featureCatalog.ts'), `${header}export const PLATFORM_FEATURES: PlatformFeature[] = ${JSON.stringify(features, null, 2)};${footer}`);
fs.writeFileSync(path.join(root, 'shared', 'platform', 'featureCatalog.json'), `${JSON.stringify(features, null, 2)}\n`);

const counts = features.reduce((acc, feature) => ({ ...acc, [feature.state]: (acc[feature.state] || 0) + 1 }), {});
console.log(`Generated 300 features: ${JSON.stringify(counts)}`);
