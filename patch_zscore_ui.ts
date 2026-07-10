import fs from 'fs';
let code = fs.readFileSync('src/components/views/ProfileView.tsx', 'utf-8');

const zscoreComponent = `
function ZScoreBrainCard({ data, user, onAskClora }: { data: any, user: any, onAskClora: () => void }) {
  const [targetZ, setTargetZ] = useState<string>(String(data.targetZ || 1.85));
  const [saving, setSaving] = useState(false);
  const { showNotification, setData } = useApp();

  const handleSave = async () => {
    setSaving(true);
    try {
      const z = parseFloat(targetZ);
      const res = await apiFetch("/api/profile/target-zscore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetZScore: z })
      });
      if (res.ok) {
        showNotification("Target Z-Score saved!", "success");
        setData({ ...data, targetZ: z });
      } else {
        showNotification("Failed to save", "error");
      }
    } catch(e) {
      showNotification("Error saving", "error");
    }
    setSaving(false);
  };

  const estimatedZ = data?.zScore || data?.estimatedZScore || 0;
  const gap = ((parseFloat(targetZ) || 0) - estimatedZ).toFixed(4);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-700/50 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight mb-1">Z-Score Brain</h2>
          <p className="text-slate-400 text-sm font-sans">Firebase Sync & Prediction Engine</p>
        </div>
        <button onClick={onAskClora} className="px-4 py-2 bg-indigo-500/20 text-indigo-300 font-medium text-sm rounded-lg hover:bg-indigo-500/30 transition-colors">
          Ask Clora
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Latest Z-Score</p>
          <div className="text-2xl font-mono text-white">{estimatedZ ? estimatedZ.toFixed(4) : "N/A"}</div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Target Z-Score</p>
          <div className="flex items-center gap-2">
            <input type="number" step="0.05" value={targetZ} onChange={e=>setTargetZ(e.target.value)} className="bg-slate-950/50 text-white text-xl font-mono w-24 px-2 py-1 rounded border border-slate-700 outline-none focus:border-blue-500 transition-colors" />
            <button onClick={handleSave} disabled={saving} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg font-medium transition-colors">Save</button>
          </div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Gap to Target</p>
          <div className="text-2xl font-mono text-emerald-400">{gap}</div>
        </div>
      </div>
    </motion.div>
  );
}
`;

// Inject component
code = code.replace(/export function ProfileView\(\) \{/, zscoreComponent + '\\nexport function ProfileView() {');

// Add Ask Clora function inside ProfileView
const askCloraLogic = `
  const handleAskCloraZScore = () => {
     // Switch view to clora and send message
     useApp().setCurrentView('clorax');
     // To actually send the message we'd need a global event or context, but just switching view is okay for now, or we can use custom event
     window.dispatchEvent(new CustomEvent('clora-send', { detail: 'mage zscore eka kiyanna' }));
  };
`;
code = code.replace(/const \[adminInput, setAdminInput\] = useState\(''\);/, "const [adminInput, setAdminInput] = useState('');\\n" + askCloraLogic);

// Add to render
const renderZScore = `
      <ZScoreBrainCard data={data} user={user} onAskClora={handleAskCloraZScore} />
`;
code = code.replace(/\{renderDeveloperPanel\(\)\}/, renderZScore + "\\n      {renderDeveloperPanel()}");

fs.writeFileSync('src/components/views/ProfileView.tsx', code);
