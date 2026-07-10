import fs from 'fs';
let content = fs.readFileSync('src/components/views/AdminDashboardView.tsx', 'utf8');

content = content.replace(
  `const apiModule = await import('../../lib/api'); const api = apiModule.default || apiModule;
      const res = await api.get('/knowledge/stats');
      if (res.ok) setRagStats(res.stats);`,
  `const { apiFetch } = await import('../../lib/api');
      const response = await apiFetch('/api/knowledge/stats');
      const res = await response.json();
      if (res.ok) setRagStats(res.stats);`
);

content = content.replace(
  `const apiModule = await import('../../lib/api'); const api = apiModule.default || apiModule;
      const res = await api.post('/knowledge/' + endpoint, {});
      if (res.ok) {`,
  `const { apiFetch } = await import('../../lib/api');
      const response = await apiFetch('/api/knowledge/' + endpoint, { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' }});
      const res = await response.json();
      if (res.ok) {`
);

fs.writeFileSync('src/components/views/AdminDashboardView.tsx', content);
