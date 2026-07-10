import fs from 'fs';
let content = fs.readFileSync('src/components/views/AdminDashboardView.tsx', 'utf8');

const newAdminFeatures = `
  const [ragStats, setRagStats] = useState<any>(null);
  
  const fetchRagStats = async () => {
    try {
      const { api } = await import('../../lib/api');
      const res = await api.get('/knowledge/stats');
      if (res.ok) setRagStats(res.stats);
    } catch (e: any) {
      showNotification('Failed to fetch stats: ' + e.message, 'error');
    }
  };

  const handleRagIngest = async (endpoint: string) => {
    showNotification('Ingestion started...', 'info');
    try {
      const { api } = await import('../../lib/api');
      const res = await api.post('/knowledge/' + endpoint, {});
      if (res.ok) {
        showNotification(\`Success! Sources: \${res.sourceCount}, Chunks: \${res.chunkCount}\`, 'success');
        fetchRagStats();
      } else {
        showNotification(res.error || 'Ingest failed', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };
`;

if (!content.includes('fetchRagStats')) {
  content = content.replace('const [jsonInput, setJsonInput] = useState(\'\');', 'const [jsonInput, setJsonInput] = useState(\'\');\n' + newAdminFeatures);
  
  const renderFeatures = `
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center justify-between">
          <span>RAG / Knowledge Management</span>
          <button onClick={fetchRagStats} className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white">Refresh Stats</button>
        </h2>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <button onClick={() => handleRagIngest('ingest-syllabus')} className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg font-medium transition-colors">
            Rebuild Syllabus RAG
          </button>
          <button onClick={() => handleRagIngest('ingest-question-bank')} className="px-4 py-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg font-medium transition-colors">
            Import Question Bank
          </button>
          <button onClick={() => handleRagIngest('ingest-past-papers')} className="px-4 py-2 bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded-lg font-medium transition-colors">
            Import Past Paper Data
          </button>
        </div>

        {ragStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Sources</div>
              <div className="text-2xl font-bold text-white">{ragStats.sourcesCount}</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Chunks</div>
              <div className="text-2xl font-bold text-white">{ragStats.chunksCount}</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">By Subject</div>
              <div className="text-sm text-gray-300">
                SFT: {ragStats.bySubject?.sft || 0}<br/>
                ET: {ragStats.bySubject?.et || 0}<br/>
                ICT: {ragStats.bySubject?.ict || 0}
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 overflow-auto">
              <div className="text-sm text-gray-400 mb-1">Last Updated</div>
              <div className="text-xs text-gray-300 truncate">{ragStats.lastUpdated}</div>
            </div>
          </div>
        )}
      </div>
  `;

  content = content.replace(
    '<div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">',
    renderFeatures + '\n<div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">'
  );
}
fs.writeFileSync('src/components/views/AdminDashboardView.tsx', content);
