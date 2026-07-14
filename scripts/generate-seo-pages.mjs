import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const SITE_URL = String(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || 'https://tecal.vercel.app').replace(/\/$/, '');
const YEARS = Array.from({ length: 12 }, (_, index) => 2026 - index);

const SUBJECTS = {
  sft: {
    short: 'SFT',
    name: 'Science for Technology',
    sinhala: 'තාක්ෂණවේදය සඳහා විද්‍යාව',
    summary: 'science, applied mathematics, ICT and technology concepts used across the A/L Technology stream',
    structure: '50 MCQs, structured questions and essay practice across biology, chemistry, mathematics, ICT and applied physics',
    lessons: [
      ['cells-microbiology', 'සෛල හා ක්ෂුද්‍රජීව විද්‍යාව', 'Cells and microbiology', 'saila, kshudra jeevi vidyawa', 'Q1–5'],
      ['bio-agents', 'ජෛවාණු', 'Biological agents', 'jaivanu', 'Q6–7'],
      ['thermochemistry', 'තාප රසායනය', 'Thermochemistry', 'thapa rasayanaya', 'Q8'],
      ['chemical-kinetics', 'චාලක රසායනය', 'Chemical kinetics', 'chalaka rasayanaya', 'Q9'],
      ['polymers', 'බහුඅවයවික', 'Polymers', 'bahu awayawika', 'Q10–11'],
      ['natural-products', 'ස්වභාවික නිෂ්පාදන', 'Natural products', 'swabhavika nishpadana', 'Q12–13'],
      ['chemical-industries', 'රසායනික කර්මාන්ත', 'Chemical industries', 'rasayanika karmanthaya', 'Q14–15'],
      ['environment', 'පරිසරය', 'Environment', 'parisaraya', 'Q16–17'],
      ['measuring-instruments', 'මිනුම් උපකරණ', 'Measuring instruments', 'minum upakarana', 'Q18'],
      ['area-volume', 'වර්ගඵලය හා පරිමාව', 'Area and volume', 'wargapalaya ha parimawa', 'Q19–21'],
      ['trigonometry', 'ත්‍රිකෝණමිතිය', 'Trigonometry', 'thrikonamithiya', 'Q22–23'],
      ['coordinate-geometry', 'ඛණ්ඩාංක ජ්‍යාමිතිය', 'Coordinate geometry', 'khandanka jyamithiya', 'Q24–25'],
      ['statistics', 'සංඛ්‍යානය', 'Statistics', 'sankyanaya', 'Q26–28'],
      ['ict-foundations', 'තොරතුරු තාක්ෂණය', 'ICT foundations', 'thorathuru thakshanaya', 'Q29–36'],
      ['motion', 'චලිතය', 'Motion', 'chalithaya', 'Q37–39'],
      ['force', 'බලය', 'Force', 'balaya', 'Q40–41'],
      ['mechanical-energy', 'යාන්ත්‍රික ශක්තිය', 'Mechanical energy', 'yanthrika shakthiya', 'Q42'],
      ['mechanical-properties', 'පදාර්ථයේ යාන්ත්‍රික ගුණ', 'Mechanical properties of matter', 'padarthaye yanthrika guna', 'Q43–44'],
      ['fluid-mechanics', 'තරල', 'Fluid mechanics', 'tharala', 'Q45–46'],
      ['heat', 'තාපය', 'Heat', 'thapaya', 'Q47–48'],
      ['electricity', 'විද්‍යුතය', 'Electricity', 'vidyuthaya', 'Q49–50'],
    ],
  },
  et: {
    short: 'ET',
    name: 'Engineering Technology',
    sinhala: 'ඉංජිනේරු තාක්ෂණවේදය',
    summary: 'civil, mechanical, production, electrical and electronic technology for the A/L Technology stream',
    structure: '50 MCQs plus structured and essay practice covering civil, mechanical, production, electrical and electronic technology',
    lessons: [
      ['introduction', 'හැඳින්වීම', 'Engineering technology introduction', 'handinweema', 'Q1'],
      ['measurement', 'මිනුම්', 'Measurement', 'minum', 'Q2–3'],
      ['standards-specifications', 'ප්‍රමිති සහ පිරිවිතර', 'Standards and specifications', 'pramithi saha pirivithara', 'Q4'],
      ['technical-drawing', 'තාක්ෂණික ඇඳීම', 'Technical drawing', 'drawing, andeema', 'Q5–6'],
      ['safety', 'ආරක්ෂාව', 'Engineering safety', 'safety, arakshawa', 'Q7'],
      ['entrepreneurship', 'ව්‍යවසායකත්වය', 'Entrepreneurship', 'vyawasayakathwaya', 'Q8–10'],
      ['civil-technology', 'සිවිල් තාක්ෂණවේදය', 'Civil technology', 'civil thakshanawedaya', 'Q11–15'],
      ['surveying', 'බිම් මැනුම්', 'Surveying', 'bim manum', 'Q16–18'],
      ['tds', 'තාක්ෂණික දත්ත සටහන්', 'Technical data sheets', 'TDS', 'Q19–20'],
      ['waste-disposal', 'කසළ අපවහනය', 'Waste disposal', 'kasala apawahanaya', 'Q21–22'],
      ['motion', 'චලිතය', 'Motion', 'chalithaya', 'Q23–24'],
      ['automobile', 'මෝටර් රථ තාක්ෂණය', 'Automobile technology', 'automobile, motor ratha', 'Q25–29'],
      ['fluid-machinery', 'තරල යන්ත්‍ර', 'Fluid machinery', 'tharala yanthra', 'Q30–31'],
      ['production', 'නිෂ්පාදන තාක්ෂණය', 'Production technology', 'nishpadana thakshanaya', 'Q32–38'],
      ['electrical-machines', 'විදුලි යන්ත්‍ර', 'Electrical machines', 'viduli yanthra', 'Q39–40'],
      ['electrical', 'විදුලි තාක්ෂණය', 'Electrical technology', 'electrical, viduli', 'Q41–44'],
      ['electronics', 'ඉලෙක්ට්‍රොනික තාක්ෂණය', 'Electronic technology', 'electronic, ilektronika', 'Q45–50'],
    ],
  },
  ict: {
    short: 'ICT',
    name: 'Information and Communication Technology',
    sinhala: 'තොරතුරු හා සන්නිවේදන තාක්ෂණය',
    summary: 'computing, networks, databases, programming, web technology and information systems for A/L ICT',
    structure: '50 MCQs plus structured and essay practice across computing concepts, programming, databases, networks and web systems',
    lessons: [
      ['ict-concepts', 'ICT සංකල්ප හා හැඳින්වීම', 'ICT concepts and introduction', 'ICT sankalpa', 'Q1–6'],
      ['number-systems', 'සංඛ්‍යා පද්ධති', 'Number systems', 'sankya paddhathi', 'Q7–10'],
      ['logic-gates', 'තාර්කික ද්වාර', 'Logic gates', 'tharkika dwara', 'Q11–14'],
      ['operating-systems', 'මෙහෙයුම් පද්ධති', 'Operating systems', 'meheyum paddhathi, OS', 'Q15–18'],
      ['networking', 'පරිගණක ජාල', 'Computer networking', 'pariganaka jala', 'Q19–24'],
      ['information-systems', 'තොරතුරු පද්ධති', 'Information systems', 'thorathuru paddhathi', 'Q25–29'],
      ['databases', 'දත්ත සමුදාය', 'Databases', 'daththa samudaya, database', 'Q30–34'],
      ['python', 'පයිතන් ක්‍රමලේඛනය', 'Python programming', 'python kramalekhanaya', 'Q35–40'],
      ['web-development', 'වෙබ් තාක්ෂණය', 'Web development', 'web thakshanaya', 'Q41–45'],
      ['iot-ecommerce-trends', 'IoT, ඊ-වාණිජ්‍යය හා නව ප්‍රවණතා', 'IoT, e-commerce and new trends', 'IoT, e vanijyaya', 'Q46–50'],
    ],
  },
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const absolute = (pathname) => `${SITE_URL}${pathname}`;
const appArchiveLink = (subject, extra = {}) => {
  const params = new URLSearchParams({ subject, ...extra });
  return `/past-papers?${params.toString()}`;
};

const styles = `
  :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;background:#f8fafc}
  *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#fff 0,#f8fafc 42%);line-height:1.65}a{color:inherit}
  .shell{max-width:1120px;margin:auto;padding:28px 20px 72px}.nav{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:8px 0 28px}.brand{font-weight:850;letter-spacing:-.03em;text-decoration:none}.navlinks{display:flex;gap:8px;flex-wrap:wrap}.navlinks a,.chip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 13px;text-decoration:none;font-size:13px;font-weight:650}
  .hero{border:1px solid #e2e8f0;background:rgba(255,255,255,.92);border-radius:30px;padding:clamp(28px,5vw,58px);box-shadow:0 24px 80px rgba(15,23,42,.08)}.eyebrow{color:#4f46e5;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.hero h1{font-size:clamp(32px,6vw,62px);line-height:1.04;letter-spacing:-.055em;margin:15px 0 18px;max-width:900px}.lead{font-size:clamp(16px,2vw,20px);color:#475569;max-width:780px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;border-radius:14px;padding:12px 17px;background:#111827;color:#fff;text-decoration:none;font-weight:750}.button.secondary{background:#fff;color:#0f172a;border:1px solid #dbe3ef}
  .section{margin-top:34px}.section h2{font-size:clamp(24px,3vw,34px);letter-spacing:-.035em;margin:0 0 10px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}.card{display:block;border:1px solid #e2e8f0;background:#fff;border-radius:20px;padding:20px;text-decoration:none;box-shadow:0 7px 28px rgba(15,23,42,.04)}.card:hover{border-color:#a5b4fc;transform:translateY(-1px)}.card h3{margin:0 0 8px;font-size:17px;letter-spacing:-.02em}.card p{margin:0;color:#64748b;font-size:14px}.meta{margin-top:12px;font-size:12px;font-weight:750;color:#4f46e5}.list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.list a{border-bottom:1px solid #e2e8f0;padding:12px 2px;text-decoration:none;font-weight:650}.notice{border:1px solid #c7d2fe;background:#eef2ff;border-radius:18px;padding:18px 20px;color:#3730a3}.crumbs{font-size:13px;color:#64748b;margin-bottom:16px}.crumbs a{text-decoration:none}.footer{border-top:1px solid #e2e8f0;margin-top:48px;padding-top:24px;color:#64748b;font-size:13px}
  @media(max-width:760px){.grid,.list{grid-template-columns:1fr}.nav{align-items:flex-start;flex-direction:column}.hero{border-radius:24px}.shell{padding-inline:14px}}
`;

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`;
}

function pageTemplate({ pathname, title, description, eyebrow, heading, lead, breadcrumbs = [], body, schema = [] }) {
  const canonical = absolute(pathname);
  const breadcrumbItems = [{ name: 'Clora X', item: absolute('/paper-structure') }, ...breadcrumbs.map((item) => ({ name: item.name, item: absolute(item.href) }))];
  const structured = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: canonical, description, inLanguage: ['si', 'en'], isPartOf: { '@type': 'WebSite', name: 'Clora X', url: SITE_URL } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.item })) },
    ...schema,
  ];
  return `<!doctype html>
<html lang="si"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Clora X"><meta property="og:locale" content="si_LK"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#ffffff"><style>${styles}</style>${structured.map(jsonLd).join('')}</head>
<body><main class="shell"><nav class="nav" aria-label="Main navigation"><a class="brand" href="/paper-structure">Clora X</a><div class="navlinks"><a href="/past-papers/sft">SFT</a><a href="/past-papers/et">ET</a><a href="/past-papers/ict">ICT</a><a href="/resources">Resources</a></div></nav>
${breadcrumbs.length ? `<div class="crumbs"><a href="/resources">Resources</a> / ${breadcrumbs.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a>`).join(' / ')}</div>` : ''}
<header class="hero"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(heading)}</h1><p class="lead">${escapeHtml(lead)}</p><div class="actions"><a class="button" href="/paper-structure">Open learning dashboard</a><a class="button secondary" href="/past-papers">Browse paper library</a></div></header>${body}
<footer class="footer"><strong>Clora X</strong> · Sinhala-first learning support for Sri Lankan G.C.E. A/L Technology students.<br>Resource availability changes as the private library is updated. Clora X is not an official Department of Examinations website and does not claim affiliation with named teachers.</footer></main></body></html>`;
}

async function writePage(pathname, html) {
  const directory = path.join(DIST_DIR, pathname.replace(/^\//, ''));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html, 'utf8');
}

const generatedUrls = [];
const remember = (pathname) => generatedUrls.push(absolute(pathname));

for (const [key, subject] of Object.entries(SUBJECTS)) {
  const subjectPath = `/past-papers/${key}`;
  const lessonHubPath = `/lessons/${key}`;
  const yearCards = YEARS.map((year) => `<a class="card" href="${subjectPath}/${year}"><h3>${year} A/L ${subject.short}</h3><p>Question papers, marking schemes and current indexed-resource availability.</p><div class="meta">OPEN ${year} ARCHIVE →</div></a>`).join('');
  const lessonCards = subject.lessons.map(([slug, si, en, singlish, range]) => `<a class="card" href="${lessonHubPath}/${slug}"><h3>${escapeHtml(si)} · ${escapeHtml(en)}</h3><p>${escapeHtml(singlish)}</p><div class="meta">${escapeHtml(range)} · LESSON PRACTICE</div></a>`).join('');

  await writePage(subjectPath, pageTemplate({
    pathname: subjectPath,
    title: `A/L ${subject.short} Past Papers & Marking Schemes | Clora X`,
    description: `Browse Sri Lanka G.C.E. A/L ${subject.short} ${subject.name} past-paper years, marking-scheme searches and lesson-wise practice in Sinhala and English.`,
    eyebrow: `G.C.E. A/L · ${subject.short}`,
    heading: `${subject.short} past papers, marking schemes and lesson practice`,
    lead: `${subject.sinhala} (${subject.name}) resources organized by examination year and syllabus lesson. Search Sinhala, English or common Singlish lesson names without losing the subject context.`,
    breadcrumbs: [{ name: `${subject.short} papers`, href: subjectPath }],
    body: `<section class="section"><h2>Choose an examination year</h2><p class="muted">Each archive keeps the question-paper and marking-scheme intent together and opens the matching ${subject.short} filter in the app.</p><div class="grid">${yearCards}</div></section><section class="section"><h2>Practice by lesson</h2><p class="muted">${escapeHtml(subject.structure)}.</p><div class="grid">${lessonCards}</div></section>`,
    schema: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `A/L ${subject.short} past-paper archive`, about: { '@type': 'Course', name: subject.name, educationalLevel: 'G.C.E. Advanced Level', inLanguage: ['si', 'en'] } }],
  }));
  remember(subjectPath);

  await writePage(lessonHubPath, pageTemplate({
    pathname: lessonHubPath,
    title: `A/L ${subject.short} Lessons in Sinhala, English & Singlish | Clora X`,
    description: `Find ${subject.short} lesson-wise paper practice using Sinhala, English and common Singlish lesson names mapped to the A/L syllabus.`,
    eyebrow: `${subject.short} lesson index`,
    heading: `${subject.short} lesson-wise paper practice`,
    lead: `A syllabus-aligned index for ${subject.sinhala}: ${subject.summary}. Every topic links back to the paper library and learning dashboard.`,
    breadcrumbs: [{ name: `${subject.short} lessons`, href: lessonHubPath }],
    body: `<section class="section"><h2>Lesson index</h2><div class="grid">${lessonCards}</div></section><section class="section notice"><strong>Search tip:</strong> Sinhala script, the English lesson name and common Singlish spellings are shown together so students can recognize the same syllabus topic.</section>`,
  }));
  remember(lessonHubPath);

  for (const year of YEARS) {
    const pathname = `${subjectPath}/${year}`;
    const previous = year > YEARS.at(-1) ? `${subjectPath}/${year - 1}` : null;
    const next = year < YEARS[0] ? `${subjectPath}/${year + 1}` : null;
    const navigation = [previous && `<a class="chip" href="${previous}">← ${year - 1}</a>`, next && `<a class="chip" href="${next}">${year + 1} →</a>`].filter(Boolean).join(' ');
    await writePage(pathname, pageTemplate({
      pathname,
      title: `${year} A/L ${subject.short} Past Paper & Marking Scheme | Clora X`,
      description: `Find ${year} Sri Lanka G.C.E. A/L ${subject.short} ${subject.name} paper and marking-scheme resources, with lesson-wise ${subject.short} practice links.`,
      eyebrow: `${year} G.C.E. A/L · ${subject.short}`,
      heading: `${year} ${subject.short} past paper and marking scheme`,
      lead: `Open the ${year} ${subject.name} archive for question papers, marking schemes and model-paper resources currently indexed by Clora X. Sinhala-medium searches such as “${year} ${subject.short} paper” and “${year} ${subject.short} marking scheme” resolve to this single useful archive.`,
      breadcrumbs: [{ name: `${subject.short} papers`, href: subjectPath }, { name: String(year), href: pathname }],
      body: `<section class="section"><h2>Open the ${year} archive</h2><p class="muted">The app filter shows only resources currently saved for ${subject.short}; availability and file ownership are never invented by this landing page.</p><div class="actions"><a class="button" href="${appArchiveLink(key, { year: String(year) })}">Search ${year} ${subject.short} papers</a><a class="button secondary" href="${appArchiveLink(key, { search: `${year} marking scheme` })}">Search marking schemes</a></div></section><section class="section"><h2>What to practise</h2><div class="grid"><div class="card"><h3>Question paper</h3><p>Use the paper view for timed MCQ, structured and essay practice.</p></div><div class="card"><h3>Marking scheme</h3><p>Compare answers only with a matching year, subject, paper and medium.</p></div><div class="card"><h3>Lesson review</h3><p>${escapeHtml(subject.structure)}.</p></div></div></section><section class="section"><h2>${subject.short} lessons</h2><div class="list">${subject.lessons.slice(0, 10).map(([slug, si, en]) => `<a href="${lessonHubPath}/${slug}">${escapeHtml(si)} · ${escapeHtml(en)}</a>`).join('')}</div></section><div class="section navlinks">${navigation}</div>`,
      schema: [{ '@context': 'https://schema.org', '@type': 'LearningResource', name: `${year} A/L ${subject.short} paper resource index`, educationalLevel: 'G.C.E. Advanced Level', learningResourceType: ['past paper', 'marking scheme'], about: subject.name, inLanguage: ['si', 'en'] }],
    }));
    remember(pathname);
  }

  for (const [slug, si, en, singlish, range] of subject.lessons) {
    const pathname = `${lessonHubPath}/${slug}`;
    await writePage(pathname, pageTemplate({
      pathname,
      title: `${si} (${en}) ${subject.short} Papers | Clora X`,
      description: `${subject.short} ${si} / ${en} lesson-wise past-paper practice, syllabus question range ${range}, with Sinhala, English and Singlish search aliases.`,
      eyebrow: `${subject.short} · ${range}`,
      heading: `${si} · ${en}`,
      lead: `This ${subject.short} lesson is commonly searched as “${singlish}”. Use the syllabus mapping (${range}) to locate relevant questions and review the matching saved resources without mixing subjects or years.`,
      breadcrumbs: [{ name: `${subject.short} lessons`, href: lessonHubPath }, { name: en, href: pathname }],
      body: `<section class="section"><h2>Lesson-wise practice</h2><div class="grid"><div class="card"><h3>Syllabus mapping</h3><p>${escapeHtml(range)} in the ${subject.short} MCQ structure.</p></div><div class="card"><h3>Search aliases</h3><p>${escapeHtml(si)} · ${escapeHtml(en)} · ${escapeHtml(singlish)}</p></div><div class="card"><h3>Evidence rule</h3><p>Answers should use the matching saved paper, marking scheme or lesson resource—not a fabricated source.</p></div></div><div class="actions"><a class="button" href="${appArchiveLink(key, { search: en })}">Search saved resources</a><a class="button secondary" href="/clora-x">Ask the learning assistant</a></div></section><section class="section"><h2>Recent ${subject.short} paper years</h2><div class="list">${YEARS.slice(0, 8).map((year) => `<a href="${subjectPath}/${year}">${year} A/L ${subject.short} paper and marking scheme</a>`).join('')}</div></section>`,
      schema: [{ '@context': 'https://schema.org', '@type': 'LearningResource', name: `${subject.short} ${en} lesson practice`, educationalLevel: 'G.C.E. Advanced Level', about: en, teaches: si, inLanguage: ['si', 'en'] }],
    }));
    remember(pathname);
  }
}

const subjectCards = Object.entries(SUBJECTS).map(([key, subject]) => `<a class="card" href="/past-papers/${key}"><h3>${subject.short} · ${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.sinhala)}</p><div class="meta">PAST PAPERS + LESSONS →</div></a>`).join('');
const teacherFilters = [
  ['Ravindu Bandaranayake', 'Ravindu Bandaranayake'],
  ['Upul Weerasinghe', 'Upul Weerasinghe'],
].map(([label, value]) => `<a class="card" href="${appArchiveLink('sft', { teacher: value })}"><h3>${label}</h3><p>Search only resource titles, author fields and tags currently saved in the library.</p><div class="meta">RESOURCE FILTER · NO AFFILIATION CLAIM</div></a>`).join('');

await writePage('/resources', pageTemplate({
  pathname: '/resources',
  title: 'Sri Lanka A/L Technology Past Papers & Lessons | Clora X',
  description: 'A searchable A/L Technology resource hub for SFT, ET and ICT past papers, marking schemes and lesson-wise practice in Sinhala, English and Singlish.',
  eyebrow: 'Sri Lanka G.C.E. A/L Technology',
  heading: 'Past papers, marking schemes and lessons—organized for real study',
  lead: 'Choose SFT, ET or ICT, then narrow by examination year or syllabus lesson. The public index describes the learning structure; protected PDFs and personal progress remain inside the signed-in app.',
  breadcrumbs: [{ name: 'Resources', href: '/resources' }],
  body: `<section class="section"><h2>Choose a subject</h2><div class="grid">${subjectCards}</div></section><section class="section"><h2>Teacher-tagged resource searches</h2><p class="muted">These names are optional library filters. A result appears only when a saved resource actually contains the matching teacher/author tag; Clora X does not claim endorsement or affiliation.</p><div class="grid">${teacherFilters}</div></section><section class="section notice"><strong>Useful search patterns:</strong> year + subject + paper, year + subject + marking scheme, Sinhala lesson name, English lesson name, or the common Singlish spelling.</section>`,
  schema: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Clora X A/L Technology resource index', about: ['Science for Technology', 'Engineering Technology', 'Information and Communication Technology'] }],
}));
remember('/resources');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
  absolute('/paper-structure'),
  absolute('/past-papers'),
  ...generatedUrls,
].map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(path.join(DIST_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin-dashboard\nDisallow: /pdf-intel-admin\nDisallow: /a3-war-room\n\nSitemap: ${absolute('/sitemap.xml')}\n`, 'utf8');
await writeFile(path.join(DIST_DIR, 'llms.txt'), `# Clora X\n\nSinhala-first learning support for Sri Lankan G.C.E. A/L Technology students.\n\n## Public indexes\n- ${absolute('/resources')}\n- ${absolute('/past-papers/sft')}\n- ${absolute('/past-papers/et')}\n- ${absolute('/past-papers/ict')}\n\nProtected PDFs and personal student data require authentication and must not be treated as public web content.\n`, 'utf8');

console.log(`[SEO] Generated ${generatedUrls.length + 2} indexable URLs for ${SITE_URL}`);
