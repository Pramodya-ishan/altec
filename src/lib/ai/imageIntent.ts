const IMAGE_NOUNS = /(?:image|picture|illustration|diagram|infographic|visual|chart|graph|රූප(?:ය|යක්)?|පින්තූර(?:ය|යක්)?|රූප\s*සටහන|ප්‍රස්තාර(?:ය|යක්)?|සටහන(?:ක්)?)/iu;
const IMAGE_ACTIONS = /(?:create|generate|draw|make|design|show|visuali[sz]e|render|හදන්න|සාදන්න|අඳින්න|නිර්මාණය|පෙන්වන්න|hadanna|hadan|adinna|pennanna)/iu;
const ANALYSIS_ACTIONS = /(?:explain this image|what is in this image|analy[sz]e this image|මේ රූපය පැහැදිලි|මේ පින්තූරය|රූපයේ තියෙන්නේ)/iu;
const VISUAL_EXPLANATION = /(?:explain|පැහැදිලි|pehedili|explain\s*krn|explain\s*karan).{0,45}(?:with|using|සමඟ|සමග|එක්ක|මඟින්|ekkin|ekka).{0,20}(?:image|picture|diagram|visual|රූප|පින්තූර|සටහන)|(?:image|picture|diagram|visual|රූප(?:යක්|ය|\s*සටහනක්?)?|පින්තූර(?:යක්|ය)?|සටහනක්?).{0,35}(?:with|using|සමඟ|සමග|එක්ක|මඟින්|ekkin|ekka).{0,25}(?:explain|පැහැදිලි|pehedili)/iu;

export function isClientVisualExplanationIntent(value: unknown) {
  const prompt = String(value || '').normalize('NFKC').trim();
  return Boolean(prompt && IMAGE_NOUNS.test(prompt) && VISUAL_EXPLANATION.test(prompt));
}

export function isClientImageGenerationIntent(value: unknown, hasAttachedImage = false) {
  const prompt = String(value || '').normalize('NFKC').trim();
  const wantsVisualExplanation = isClientVisualExplanationIntent(prompt);
  if (!prompt || !IMAGE_NOUNS.test(prompt) || (!IMAGE_ACTIONS.test(prompt) && !wantsVisualExplanation)) return false;
  if (hasAttachedImage && ANALYSIS_ACTIONS.test(prompt) && !wantsVisualExplanation) return false;
  return true;
}
