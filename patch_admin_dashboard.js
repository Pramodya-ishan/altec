import fs from 'fs';

let content = fs.readFileSync('src/components/views/AdminDashboardView.tsx', 'utf8');

if (!content.includes('Model Health')) {
  // Add a section for Model Health.
  // There is usually a layout we can inject it into.
  // We'll replace a closing div before the end with our new panel.
  // Wait, let's just create a new file or see how we can inject it.
  
  // Let's just find the last </div>
  const injection = `
      {/* Model Health Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              AI Model Health & Billing
            </h3>
            <p className="text-sm text-slate-500 mt-1">Monitor Gemini API circuit breaker and status</p>
          </div>
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/ai/model-health');
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              } catch (e) {
                alert(e.message);
              }
            }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Check Health
          </button>
        </div>
      </div>
  `;
  
  content = content.replace(/(<\/div>\s*<\/div>\s*)$/, injection + "\n$1");
  fs.writeFileSync('src/components/views/AdminDashboardView.tsx', content);
}
