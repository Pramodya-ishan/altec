import fs from 'fs';

// 1. Sidebar.tsx
let sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace("import { BookOpen, Link, useLocation }", "import { Link, useLocation }");
sidebar = sidebar.replace("import { BookOpen, Link, useNavigate, useLocation }", "import { Link, useNavigate, useLocation }");
sidebar = sidebar.replace("import { ", "import { BookOpen, "); // Wait, let's just use string replace on lucide-react import
if (sidebar.includes('lucide-react')) {
  // Add BookOpen to lucide-react import
  sidebar = sidebar.replace("import { ", "import { BookOpen, ");
  // Remove from react-router-dom
  sidebar = sidebar.replace("BookOpen, Link", "Link");
}
fs.writeFileSync('src/components/layout/Sidebar.tsx', sidebar);

// 2. KnowledgeBaseView.tsx
let kb = fs.readFileSync('src/components/views/KnowledgeBaseView.tsx', 'utf8');
kb = kb.replace("src.uploadedByUid === user?.uid", "src.uploadedByUid === (user as any)?.uid");
fs.writeFileSync('src/components/views/KnowledgeBaseView.tsx', kb);

// 3. server/ai/respondStream.ts
let respondStream = fs.readFileSync('server/ai/respondStream.ts', 'utf8');
// Fix c.sourceTitle and c.page
respondStream = respondStream.replace(/c\.title \|\| c\.sourceTitle/g, 'c.title');
respondStream = respondStream.replace(/c\.page \|\| c\.year/g, 'c.year');
fs.writeFileSync('server/ai/respondStream.ts', respondStream);

