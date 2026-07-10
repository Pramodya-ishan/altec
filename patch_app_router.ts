import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Import
if (!content.includes('KnowledgeBaseView')) {
  content = content.replace(
    'import { ProfileView } from \'./components/views/ProfileView\';',
    'import { ProfileView } from \'./components/views/ProfileView\';\nimport { KnowledgeBaseView } from \'./components/views/KnowledgeBaseView\';'
  );

  content = content.replace(
    'case \'profile\': return <ProfileView />;',
    'case \'profile\': return <ProfileView />;\n      case \'knowledge\': return <KnowledgeBaseView />;'
  );
  
  fs.writeFileSync('src/App.tsx', content);
}

// Add to Sidebar
let sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
if (!sidebar.includes('knowledge')) {
  sidebar = sidebar.replace(
    'const mainLinks = [',
    `const mainLinks = [
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },`
  );
  sidebar = sidebar.replace('import { ', 'import { BookOpen, ');
  fs.writeFileSync('src/components/layout/Sidebar.tsx', sidebar);
}
