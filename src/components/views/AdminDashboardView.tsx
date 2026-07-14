import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { motion } from 'motion/react';
import { db, isFirebaseEnabled } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

export default function AdminDashboardView() {
 const { user, showNotification, profile } = useApp();
 const [users, setUsers] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
 const [userDataCache, setUserDataCache] = useState<any>(null);
 const [jsonInput, setJsonInput] = useState('');

  const [ragStats, setRagStats] = useState<any>(null);
  
  const fetchRagStats = async () => {
    try {
      const { apiFetch } = await import('../../lib/api');
      const response = await apiFetch('/api/rag/debug');
      const res = await response.json();
      if (res.ok) setRagStats(res.stats);
    } catch (e: any) {
      showNotification('Failed to fetch stats: ' + e.message, 'error');
    }
  };

  const handleRagIngest = async (endpoint: string) => {
    showNotification('Ingestion started...', 'info');
    try {
      const { apiFetch } = await import('../../lib/api');
      const response = await apiFetch('/api/rag/' + endpoint, { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' }});
      const res = await response.json();
      if (res.ok) {
        showNotification(`Success! Sources: ${res.sourceCount}, Chunks: ${res.chunkCount}`, 'success');
        fetchRagStats();
      } else {
        showNotification(res.error || 'Ingest failed', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };


 useEffect(() => {
 fetchUsers();
 }, [user]);

 const fetchUsers = async () => {
 if (!isFirebaseEnabled || !db) {
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const snap = await getDocs(collection(db, 'users'));
 const list: any[] = [];
 snap.forEach(d => {
 list.push({ email: d.id });
 });
 setUsers(list);
 } catch (e: any) {
 showNotification('Error fetching users: ' + e.message, 'error');
 }
 setLoading(false);
 };

 const handleSelectUser = async (email: string) => {
 setSelectedUserEmail(email);
 setUserDataCache(null);
 setJsonInput('Loading...');
 try {
 const docRef = doc(db, 'users', email, 'data', 'al_blueprint_state');
 const snap = await getDoc(docRef);
 if (snap.exists()) {
 const d = snap.data();
 setUserDataCache(d);
 setJsonInput(JSON.stringify(d, null, 2));
 } else {
 setUserDataCache({});
 setJsonInput('{}');
 }
 } catch (e: any) {
 showNotification('Error fetching user data: ' + e.message, 'error');
 setJsonInput('');
 }
 };

 const handleSaveData = async () => {
 if (!selectedUserEmail) return;
 try {
 const parsed = JSON.parse(jsonInput);
 const docRef = doc(db, 'users', selectedUserEmail, 'data', 'al_blueprint_state');
 await setDoc(docRef, parsed);
 showNotification('Successfully updated data for ' + selectedUserEmail, 'success');
 } catch (e: any) {
 showNotification('Failed to save: ' + e.message, 'error');
 }
 };

  const isAdmin = profile?.role === 'admin' || profile?.roles?.includes('admin');

 if (!isAdmin) {
 return (
 <div className="flex flex-col items-center justify-center p-12 text-center h-full max-w-lg mx-auto mt-20">
 <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-200">
 <i className="fa-solid fa-lock text-3xl"></i>
 </div>
 <h2 className="text-2xl font-bold font-display tracking-tight text-slate-800 mb-2">Access Restricted</h2>
 <p className="text-slate-500 font-medium text-sm">You need administrator privileges to view this page. This area is strictly for system managers.</p>
 </div>
 );
 }

 return (
 <div className="space-y-6 max-w-7xl mx-auto w-full pb-20">
 <div className="flex items-center gap-4 border-b border-slate-200 pb-5 pt-4">
 <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-xl shadow border border-indigo-400">
 <i className="fa-solid fa-server"></i>
 </div>
 <div>
 <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">System Admin Console</h1>
 <p className="text-sm font-bold text-slate-500">Manage student accounts, edit data payloads directly, and monitor global Z-scores.</p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Users List */}
 <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 flex flex-col h-[600px]">
 <h2 className="text-sm font-black tracking-widest uppercase text-slate-400 mb-4 flex items-center gap-2">
 <i className="fa-solid fa-users text-indigo-400"></i> Registered Students
 </h2>
 <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
 {loading ? (
 <div className="space-y-3">
   {[1, 2, 3, 4, 5].map((i) => (
     <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-100 animate-pulse">
       <div className="w-8 h-8 rounded-full bg-slate-200"></div>
       <div className="space-y-2 flex-1">
         <div className="h-3 bg-slate-200 rounded w-1/2"></div>
         <div className="h-2 bg-slate-100 rounded w-3/4"></div>
       </div>
     </div>
   ))}
 </div>
) : users.length === 0 ? (
 <div className="p-4 text-center text-slate-400 font-bold text-sm">No users found.</div>
 ) : (
 users.map(u => (
 <button
 key={u.email}
 onClick={() => handleSelectUser(u.email)}
 className={`w-full text-left p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-colors ${selectedUserEmail === u.email ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'}`}
 >
 <div className={`w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center text-xs text-white ${selectedUserEmail === u.email ? 'bg-indigo-500' : 'bg-slate-300'}`}>
 <i className="fa-solid fa-user"></i>
 </div>
 <span className="font-bold text-sm truncate flex-1">{u.email}</span>
 </button>
 ))
 )}
 </div>
 </div>

 {/* JSON Editor */}
 <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] border border-slate-700 p-6 flex flex-col h-[600px] shadow-xl relative overflow-hidden">
 <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mx-32 -my-32 pointer-events-none"></div>
 {selectedUserEmail ? (
 <div className="relative z-10 flex flex-col h-full">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
 <div>
 <h2 className="text-sm font-black tracking-widest uppercase text-emerald-400 flex items-center gap-2">
 <i className="fa-solid fa-database"></i> Live Database Payload
 </h2>
 <p className="text-xs text-slate-400 mt-1 font-mono">Editing: <span className="text-white font-bold">{selectedUserEmail}</span></p>
 </div>
 <div className="flex gap-2">
 <button onClick={handleSaveData} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xs tracking-wide uppercase rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap">
 <i className="fa-solid fa-floppy-disk"></i> Force Overwrite DB
 </button>
 </div>
 </div>
 <div className="flex-1 relative mt-2">
 <div className="mb-4 bg-slate-800 border border-slate-700/50 rounded-xl p-4 shadow-sm">
 <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3"><i className="fa-solid fa-bolt mr-2"></i> Quick Edits</h4>
 <div className="flex gap-2 text-xs flex-wrap">
 <button onClick={() => {
 try{ 
 const d = JSON.parse(jsonInput); 
 d.zScoreHistory = Array.isArray(d.zScoreHistory)
   ? d.zScoreHistory.filter((entry: any) => entry?.calculationBasis === 'actual_saved_paper_marks')
   : [];
 setJsonInput(JSON.stringify(d, null, 2));
 } catch(e) {}
 }} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded shadow-sm border border-slate-600 transition-colors whitespace-nowrap">
 <i className="fa-solid fa-broom text-emerald-400 mr-1.5"></i> Remove Synthetic Z History
 </button>
 <button onClick={() => {
 try{ 
 const d = JSON.parse(jsonInput); 
 d.targetZ = 2.5; 
 setJsonInput(JSON.stringify(d, null, 2));
 } catch(e) {}
 }} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded shadow-sm border border-slate-600 transition-colors whitespace-nowrap">
 <i className="fa-solid fa-bullseye text-amber-400 mr-1.5"></i> Set Active Target (Z: 2.5)
 </button>
 </div>
 </div>
 <textarea
 value={jsonInput}
 onChange={(e) => setJsonInput(e.target.value)}
 className="w-full h-full bg-slate-950/80 text-emerald-300 font-mono text-xs leading-relaxed p-5 rounded-2xl border border-slate-600 focus:border-indigo-400 outline-none resize-none shadow-inner"
 spellCheck={false}
 />
 </div>
 </div>
 ) : (
 <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center space-y-4">
 <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50">
 <i className="fa-solid fa-user-pen text-slate-600 text-3xl"></i>
 </div>
 <div>
 <h3 className="text-white font-display font-bold text-xl tracking-tight">Select a student account</h3>
 <p className="text-slate-400 font-medium text-sm max-w-sm mt-1">Choose an email from the left sidebar to load their full JSON structure for editing.</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
