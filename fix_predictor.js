import fs from 'fs';

let p = fs.readFileSync('src/components/views/AdmissionPredictorView.tsx', 'utf8');

p = p.replace(
  '<h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/60 pb-3">',
  '<h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/80 pb-3">'
);

fs.writeFileSync('src/components/views/AdmissionPredictorView.tsx', p);
