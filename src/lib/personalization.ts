export type TutorPersonalization = {
  preferredLanguage?: 'si' | 'en';
  explanationDepth?: 'brief' | 'step_by_step' | 'exam_ready';
  weakLessons?: Record<string, string[]>;
  preferredVoice?: string;
  maxVideoMinutes?: number;
};

const STORAGE_KEY = 'altec:tutor-personalization:v1';

export function readTutorPersonalization(): TutorPersonalization {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeTutorPersonalization(value: TutorPersonalization) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function buildTutorPersonalizationContext(subject: string) {
  const prefs = readTutorPersonalization();
  const weak = Array.isArray(prefs.weakLessons?.[subject.toUpperCase()])
    ? prefs.weakLessons?.[subject.toUpperCase()]?.slice(0, 8)
    : [];
  const details = [
    `Preferred response language: ${prefs.preferredLanguage === 'en' ? 'English' : 'clear Sinhala with necessary English technical terms'}.`,
    `Preferred explanation depth: ${prefs.explanationDepth || 'step_by_step'}.`,
    weak?.length ? `Known weak lessons for ${subject.toUpperCase()}: ${weak.join(', ')}.` : '',
    `Preferred Sinhala voice: ${prefs.preferredVoice || 'clear neutral teacher voice'}.`,
    `Maximum requested lesson-video length: ${Math.max(2, Math.min(30, Number(prefs.maxVideoMinutes || 12)))} minutes.`,
  ].filter(Boolean);
  return `[Personalized tutor context]\n${details.join('\n')}\nUse this only to adapt teaching style; never invent marks, papers, or personal facts.`;
}
