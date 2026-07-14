# Search discovery deployment

The production build generates crawlable, people-first public pages for:

- SFT, ET and ICT paper archives
- examination years 2015–2026
- syllabus lessons with Sinhala, English and common Singlish names
- paper, marking-scheme and lesson-wise search intent

The generated pages live in `dist/past-papers`, `dist/lessons` and
`dist/resources`. `dist/sitemap.xml`, `dist/robots.txt` and `dist/llms.txt` are
created by `npm run generate:seo` after Vite builds the application.

## After a production deployment

1. Open Google Search Console and verify the production property. DNS
   verification is preferred when a custom domain is available.
2. Submit `https://tecal.vercel.app/sitemap.xml`.
3. Use URL Inspection for `/resources`, `/past-papers/sft`,
   `/past-papers/et`, `/past-papers/ict` and the most important recent-year
   pages, then request indexing.
4. Check Page indexing, Core Web Vitals and Search results reports weekly.
5. Earn relevant links from real school, class, teacher and student resource
   pages. Technical SEO makes pages eligible and understandable; it cannot
   guarantee a position.

## Content integrity

- Do not create fake paper availability, teacher endorsements or official
  affiliations.
- A named-teacher filter only returns resources that really contain that name
  in a title, author field or tag.
- Add new public lesson pages only when they include visible syllabus mapping
  and a useful destination. Avoid keyword-stuffed or near-duplicate pages.
- Keep protected PDFs, signed media URLs and student information out of public
  metadata and sitemaps.
