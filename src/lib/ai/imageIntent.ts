const IMAGE_NOUNS = /(?:images?|pictures?|illustrations?|diagrams?|infographics?|visuals?|charts?|graphs?|රූප(?:ය|ක්)?|පින්තූර(?:ය|ක්)?|රූප\s*සටහන|ප්‍රස්තාර(?:ය|ක්)?|සටහන(?:ක්)?)/iu;
const IMAGE_ACTIONS = /(?:create|generate|draw|make|design|show|give|visuali[sz]e|render|දෙන්න|හදන්න|සාදන්න|අඳින්න|නිර්මාණය|පෙන්වන්න|hadanna|hadan|adinna|pennanna|denna)/iu;
const ANALYSIS_ACTIONS = /(?:explain this image|what is in this image|analy[sz]e this image|මේ රූපය පැහැදිලි|මේ පින්තූරය|රූපයේ තියෙන්නේ)/iu;
const VISUAL_EXPLANATION = /(?:explain|පැහැදිලි|pehedili|explain\s*krn|explain\s*karan).{0,45}(?:with|using|සමඟ|සමග|එක්ක|මඟින්|ekkin|ekka).{0,20}(?:images?|pictures?|diagrams?|visuals?|රූප|පින්තූර|සටහන)|(?:images?|pictures?|diagrams?|visuals?|රූප(?:යක්|ය|\s*සටහනක්?)?|පින්තූර(?:යක්|ය)?|සටහනක්?).{0,35}(?:with|using|සමඟ|සමග|එක්ක|මඟින්|ekkin|ekka).{0,25}(?:explain|පැහැදිලි|pehedili)/iu;

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
