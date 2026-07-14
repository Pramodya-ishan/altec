import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateGrade, cn } from '../../lib/utils';
import { SubjectKey, PaperMark } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveChartShell } from '../ui/ResponsiveChartShell';

export default function PaperMarksView() {
 const { data, currentSubject, setModals, saveData, showNotification } = useApp();
 const marks = data[currentSubject].paperMarks || [];

 const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
 const [collapsedLog, setCollapsedLog] = useState(() => {
 return data.collapsedStates?.history_database ?? true;
 });

 React.useEffect(() => {
 if (data.collapsedStates?.history_database !== undefined) {
 setCollapsedLog(data.collapsedStates.history_database);
 }
 }, [data.collapsedStates?.history_database]);

 const toggleCollapsedLog = () => {
 const nextCollapsed = !collapsedLog;
 setCollapsedLog(nextCollapsed);
 const nextData = {
 ...data,
 collapsedStates: {
 ...data.collapsedStates,
 history_database: nextCollapsed
 }
 };
 saveData(nextData);
 };

 const maxScale = 100;
 const maxSubScale = currentSubject === 'et' ? 37.5 : 50;

 // Replace 0 with null so Recharts ignores it
 const chartData = marks.map((m: any) => ({
 ...m,
 total: m.total === 0 ? null : m.total,
 mcq: m.mcq === 0 ? null : m.mcq,
 essay: m.essay === 0 ? null : m.essay
 }));

 const confirmDelete = (index: number) => {
 const nextData = structuredClone(data);
 nextData[currentSubject].paperMarks.splice(index, 1);
 saveData(nextData);
 setConfirmDeleteIdx(null);
 showNotification('Paper log deleted safely.', 'info');
 };

 const handleEdit = (index: number) => {
 setModals(prev => ({ ...prev, addPaperMark: { open: true, editIndex: index } }));
 };

 const ChartTooltip = ({ active, payload, label }: any) => {
 if (active && payload && payload.length) {
 const dataPoint = payload[0].payload;
 return (
 <div className="bg-slate-900/90 text-white p-3 rounded-xl shadow-lg border border-slate-700/50 text-sm z-50 relative">
 <p className="font-bold mb-1">{label}</p>
 {payload.map((entry: any, i: number) => {
 if (entry.value === null || isNaN(entry.value)) return null;
 return (
 <p key={i} style={{ color: entry.color }} className="font-medium flex gap-2">
 <span>{entry.name}: {entry.value}</span>
 {entry.name === 'Total Marks' && dataPoint.grade && (
 <span className="text-slate-300">({dataPoint.grade})</span>
 )}
 </p>
 );
 })}
 </div>
 );
 }
 return null;
 };

 return (
 <div className="space-y-8 ">
 
 {/* HEADER WITH TOGGLE SWITCH */}
 

 <div className="space-y-8 flex flex-col">
 {/* TOTAL MARKS CHART */}
 <div className="bg-white p-6 border border-slate-200 rounded-[1.8rem] shadow-sm h-[360px] relative hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <div className="w-1.5 h-4 bg-primary-500 rounded-full"></div> Total Marks Progression
 </h3>
 <button
 onClick={() => setModals(prev => ({ ...prev, addPaperMark: { open: true, editIndex: -1 } }))}
 className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg w-8 h-8 flex items-center justify-center transition-colors shadow-sm cursor-pointer"
 title="Add Marks"
 >
 <i className="fa-solid fa-plus text-sm"></i>
 </button>
 </div>
 <div className="w-full h-[280px]">
 <ResponsiveChartShell minHeight={280}>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 20 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
 <XAxis dataKey="title" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v} dy={10} />
 <YAxis domain={[0, maxScale]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
 <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }} content={<ChartTooltip />} />
 <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }} />
 <Line connectNulls type="monotone" dataKey="total" name="Total Marks" stroke="var(--primary-600)" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
 </LineChart>
 </ResponsiveContainer>
 </ResponsiveChartShell>
 </div>
 </div>

 {/* SUB MARKS CHARTS */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-slate-200 rounded-[1.8rem] shadow-sm overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
 <div className="p-6 h-[280px] hover:bg-slate-50/50 transition-colors">
 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
 <i className="fa-solid fa-circle text-[8px] text-amber-500"></i> MCQ Marks <span className="text-slate-300">/</span> {maxSubScale}
 </h3>
 <div className="w-full h-[200px]">
 <ResponsiveChartShell minHeight={200}>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 20 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
 <XAxis dataKey="title" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + '...' : v} dy={10} />
 <YAxis domain={[0, maxSubScale]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
 <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }} content={<ChartTooltip />} />
 <Line connectNulls type="monotone" dataKey="mcq" name="MCQ" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
 </LineChart>
 </ResponsiveContainer>
 </ResponsiveChartShell>
 </div>
 </div>
 <div className="p-6 h-[280px] hover:bg-slate-50/50 transition-colors">
 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
 <i className="fa-solid fa-circle text-[8px] text-emerald-500"></i> Essay Marks <span className="text-slate-300">/</span> {maxSubScale}
 </h3>
 <div className="w-full h-[200px]">
 <ResponsiveChartShell minHeight={200}>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 20 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
 <XAxis dataKey="title" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(v) => v.length > 10 ? v.substring(0, 10) + '...' : v} dy={10} />
 <YAxis domain={[0, maxSubScale]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
 <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }} content={<ChartTooltip />} />
 <Line connectNulls type="monotone" dataKey="essay" name="Essay" stroke="#10b981" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
 </LineChart>
 </ResponsiveContainer>
 </ResponsiveChartShell>
 </div>
 </div>
 </div>

 {/* HISTORICS LOG TABLE */}
 <div className="bg-white border border-slate-200 rounded-[1.8rem] shadow-sm overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
 <button 
 onClick={toggleCollapsedLog}
 className="w-full flex justify-between items-center px-6 py-5 bg-slate-50/55 hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer"
 >
 <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
 <i className="fa-solid fa-clock-rotate-left text-slate-400"></i> History Database ({marks.length})
 </span>
 <i className={cn("fa-solid text-xs text-slate-400 transition-transform", collapsedLog ? "fa-chevron-down" : "fa-chevron-up")}></i>
 </button>
 
 <AnimatePresence initial={false}>
 {!collapsedLog && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 {marks.length === 0 ? (
 <div className="p-12 text-center text-slate-400 font-semibold text-sm">
 No past paper logs recorded yet. Click the "+" icon to get started.
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm border-collapse">
 <thead>
 <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
 <th className="py-4 px-6">Exam Title</th>
 <th className="py-4 px-4 text-center">MCQ ({maxSubScale})</th>
 <th className="py-4 px-4 text-center">Essay ({maxSubScale})</th>
 {currentSubject === 'et' && <th className="py-4 px-4 text-center">Practical (25)</th>}
 <th className="py-4 px-4 text-center">Total ({maxScale})</th>
 <th className="py-4 px-4 text-center">Grade</th>
 <th className="py-4 px-6 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
 {marks.map((m, idx) => (
 <tr key={m.time || idx} className="hover:bg-slate-50/50 transition-colors">
 <td className="py-4.5 px-6 text-slate-900 font-bold">{m.title}</td>
 <td className="py-4.5 px-4 text-center font-mono text-amber-600 font-extrabold">{m.mcq}</td>
 <td className="py-4.5 px-4 text-center font-mono text-emerald-600 font-extrabold">{m.essay}</td>
 {currentSubject === 'et' && (
 <td className="py-4.5 px-4 text-center font-mono text-blue-600 font-extrabold">
 {m.practical ?? 0}
 </td>
 )}
 <td className="py-4.5 px-4 text-center">
 <span className="font-mono text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs font-black">
 {m.total}
 </span>
 </td>
 <td className="py-4.5 px-4 text-center font-black">
 <span className={cn(
 "text-xs font-extrabold px-2.5 py-0.5 rounded-full inline-block",
 m.grade === 'A' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
 m.grade === 'B' ? "bg-indigo-50 text-indigo-700 border border-indigo-100" :
 m.grade === 'C' ? "bg-amber-50 text-amber-700 border border-amber-100" :
 "bg-rose-50 text-rose-700 border border-rose-100"
 )}>
 Grade {m.grade}
 </span>
 </td>
 <td className="py-4.5 px-6 text-right print-hide">
 {confirmDeleteIdx === idx ? (
 <div className="flex items-center justify-end gap-1.5">
 <span className="text-xs text-rose-600 font-extrabold">Delete?</span>
 <button onClick={() => confirmDelete(idx)} className="px-2 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 cursor-pointer">Yes</button>
 <button onClick={() => setConfirmDeleteIdx(null)} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 cursor-pointer">No</button>
 </div>
 ) : (
 <div className="flex items-center justify-end gap-2 text-slate-400">
 <button onClick={() => handleEdit(idx)} className="hover:text-primary-600 p-1 cursor-pointer transition-colors" title="Edit Log">
 <i className="fa-solid fa-pen-to-square"></i>
 </button>
 <button onClick={() => setConfirmDeleteIdx(idx)} className="hover:text-rose-600 p-1 cursor-pointer transition-colors" title="Delete Log">
 <i className="fa-solid fa-trash-can"></i>
 </button>
 </div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 );
}
