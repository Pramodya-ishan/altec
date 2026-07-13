export function sanitizeMathText(text: string): string {
  if (!text) return "";

  let res = text;

  // Fix repeated variable lines (like F F or A A)
  res = res.replace(/\b([A-Za-z])\s+\1\b/g, "$1");

  // Fix units: m 2 -> m^2
  res = res.replace(/\bm\s+2\b/g, "\\mathrm{m^2}");
  res = res.replace(/\bm\s+1\b/g, "\\mathrm{m}");

  // Fix units: N m −2 or N m-2 -> \mathrm{N\,m^{-2}}
  res = res.replace(/\bN\s+m\s+[-−]2\b/g, "\\mathrm{N\\,m^{-2}}");
  res = res.replace(/\bN\s*m\^[-−]2\b/g, "\\mathrm{N\\,m^{-2}}");

  // Fix general units like mg,L^{-1} -> mg\,L^{-1}
  res = res.replace(/\bmg,L\^?\{[-−]1\}/g, "mg\\,L^{-1}");

  // Fix "2 times10" / "2 times 10" / "2×10 −6" or "2×10-6"
  res = res.replace(/(\d+)\s*times\s*10/gi, "$1 \\times 10");
  res = res.replace(/(\d+)\s*[×*]\s*10\s*[-−]6/g, "$1 \\times 10^{-6}");
  res = res.replace(/(\d+)\s*[×*]\s*10\s*\^?\s*([-−]\d+)/g, "$1 \\times 10^{$2}");

  // Fix raw minus sign exponents: 10 −6 or 10 -6 inside or near numbers
  res = res.replace(/10\s+[-−]6/g, "10^{-6}");
  res = res.replace(/10\^[-−]6/g, "10^{-6}");

  // Normalize Unicode subtraction signs to standard hyphens inside standard LaTeX exponent patterns
  res = res.replace(/10\^\{\s*[-−](\d+)\s*\}/g, "10^{-$1}");
  res = res.replace(/10\^[-−](\d+)/g, "10^{-$1}");

  // Wrap raw LaTeX formula blocks if they aren't wrapped
  // E.g. \text{Stress} = \frac{100}{2 \times 10^{-6}}
  const unwrappedFormulaPattern = /(?:\\text|\\frac|\\sigma|\\mathrm|\\times)[^\$]+?(?=\n|$)/g;
  res = res.replace(unwrappedFormulaPattern, (match) => {
    const trimmed = match.trim();
    if (!trimmed.startsWith("$") && !trimmed.endsWith("$") && !trimmed.includes("\n")) {
      return `$${trimmed}$`;
    }
    return match;
  });

  return res;
}
