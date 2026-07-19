export function questionRequiresVisualEvidence(value: unknown) {
  const text = String(value || "").normalize("NFKC");
  return /(?:පහත\s*(?:දැක්වෙන|දක්වා\s*ඇති|රූප|සටහන)|ඉහත\s*(?:රූප|සටහන)|රූප(?:ය|යේ|යට|සටහන)|පින්තූර|ප්‍රස්තාර|වගුව|චිත්‍රය|ඉදිරි\s*පෙනුම|පැති\s*පෙනුම|සැලැස්ම|ප්‍රක්ෂේපණ|මානයන්|shown\s+(?:below|above)|following\s+(?:figure|diagram|drawing)|figure|diagram|drawing|graph|chart|table|front\s+view|side\s+view|projection|dimensions?)/iu.test(text.replace(/\s+/gu, " "));
}
