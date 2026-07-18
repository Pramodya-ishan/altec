const IMAGE_NOUNS = /(?:image|picture|illustration|diagram|infographic|visual|chart|graph|රූප(?:ය|යක්)?|පින්තූර(?:ය|යක්)?|රූප\s*සටහන|ප්‍රස්තාර(?:ය|යක්)?|සටහන(?:ක්)?)/iu;
const IMAGE_ACTIONS = /(?:create|generate|draw|make|design|show|visuali[sz]e|render|හදන්න|සාදන්න|අඳින්න|නිර්මාණය|පෙන්වන්න|hadanna|hadan|adinna|pennanna)/iu;
const ANALYSIS_ACTIONS = /(?:explain this image|what is in this image|analy[sz]e this image|මේ රූපය පැහැදිලි|මේ පින්තූරය|රූපයේ තියෙන්නේ)/iu;

export function isClientImageGenerationIntent(value: unknown, hasAttachedImage = false) {
  const prompt = String(value || '').normalize('NFKC').trim();
  if (!prompt || !IMAGE_NOUNS.test(prompt) || !IMAGE_ACTIONS.test(prompt)) return false;
  if (hasAttachedImage && ANALYSIS_ACTIONS.test(prompt)) return false;
  return true;
}
