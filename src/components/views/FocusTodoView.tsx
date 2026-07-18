import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';

type TimerMode = 'work' | 'short' | 'long';

interface Task {
 id: string;
 text: string;
 completed: boolean;
}

export function FocusTodoView() {
 const { data, saveData } = useApp();
 const [mode, setMode] = useState<TimerMode>('work');
 const [timeLeft, setTimeLeft] = useState(25 * 60);
 const [isActive, setIsActive] = useState(false);
 const [completedSessions, setCompletedSessions] = useState(0);
 
 const [tasks, setTasks] = useState<Task[]>(() => data.focusTasks || [
 { id: '1', text: 'SFT Past Paper MCQ Analysis', completed: false },
 { id: '2', text: 'Revise ET Hydraulics and Pneumatics', completed: false },
 { id: '3', text: 'Practice ICT Database queries', completed: false }
 ]);
 const [newTaskText, setNewTaskText] = useState('');
 const [showIframe, setShowIframe] = useState(false);

 const timerRef = useRef<NodeJS.Timeout | null>(null);

 useEffect(() => {
   if (data.focusTasks === tasks) return;
   saveData({ ...data, focusTasks: tasks });
 }, [tasks]);

 const modeSettings = {
 work: { label: 'Focus Time', duration: 25 * 60, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
 short: { label: 'Short Break', duration: 5 * 60, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
 long: { label: 'Long Break', duration: 15 * 60, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' }
 };

 useEffect(() => {
 setTimeLeft(modeSettings[mode].duration);
 setIsActive(false);
 }, [mode]);

 useEffect(() => {
 if (isActive && timeLeft > 0) {
 timerRef.current = setInterval(() => {
 setTimeLeft((prev) => prev - 1);
 }, 1000);
 } else if (timeLeft === 0 && isActive) {
 setIsActive(false);
 // Play soft sound if supported
 try {
 const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
 const osc = audioCtx.createOscillator();
 const gain = audioCtx.createGain();
 osc.connect(gain);
 gain.connect(audioCtx.destination);
 osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
 gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
 osc.start();
 osc.stop(audioCtx.currentTime + 0.3);
 } catch (e) {}

 if (mode === 'work') {
 setCompletedSessions((prev) => prev + 1);
 setMode('short');
 } else {
 setMode('work');
 }
 }

 return () => {
 if (timerRef.current) clearInterval(timerRef.current);
 };
 }, [isActive, timeLeft, mode]);

 const toggleTimer = () => {
 setIsActive(!isActive);
 };

 const resetTimer = () => {
 setIsActive(false);
 setTimeLeft(modeSettings[mode].duration);
 };

 const formatTime = (seconds: number) => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };

 const addTask = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newTaskText.trim()) return;
 const task: Task = {
 id: Date.now().toString(),
 text: newTaskText.trim(),
 completed: false
 };
 setTasks([...tasks, task]);
 setNewTaskText('');
 };

 const toggleTask = (id: string) => {
 setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
 };

 const deleteTask = (id: string) => {
 setTasks(tasks.filter(t => t.id !== id));
 };

 const progressPercent = ((modeSettings[mode].duration - timeLeft) / modeSettings[mode].duration) * 100;

 return (
 <div className="w-full h-full min-h-[calc(100dvh-64px)] flex flex-col bg-[#0b0c10] text-slate-100 p-4 sm:p-8 font-sans">
 
 {/* Upper Navigation & External Control */}
 <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
 <div>
 <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
 <i className="fa-solid fa-brain text-amber-500 animate-pulse"></i>
 Study & Focus Center
 </h1>
 <p className="text-slate-400 text-xs font-semibold mt-1">
 Increase your concentration with the Pomodoro Technique.
 </p>
 </div>

 <div className="flex gap-2 w-full sm:w-auto">
 <button type="button"
 onClick={() => setShowIframe(!showIframe)}
 className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-extrabold transition-all border border-slate-700/50 shadow-sm cursor-pointer"
 >
 <i className="fa-solid fa-globe mr-1.5"></i>
 {showIframe ? 'Local Study Mode' : 'Open Vercel Focus Portal'}
 </button>
 
 <a
 href="https://altec-two.vercel.app/"
 target="_blank"
 rel="noopener noreferrer"
 className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <i className="fa-solid fa-arrow-up-right-from-square"></i>
 Launch External App
 </a>
 </div>
 </div>

 <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
 {showIframe ? (
 <div className="w-full flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden min-h-[500px] shadow-2xl relative">
 <iframe
 src="https://altec-two.vercel.app/"
 className="w-full h-full absolute inset-0 border-none"
 title="Focus To Do Portal"
 allow="autoplay; fullscreen"
 sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
 />
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
 
 {/* TIMER COLUMN */}
 <div className="md:col-span-5 bg-slate-900/45 border border-slate-800 rounded-[2rem] p-6 text-center shadow-xl backdrop-blur-md">
 
 {/* Mode Selectors */}
 <div className="flex bg-slate-950/60 p-1.5 rounded-2xl gap-1 border border-slate-800/80 mb-8">
 {(['work', 'short', 'long'] as TimerMode[]).map((m) => (
 <button type="button"
 key={m}
 onClick={() => setMode(m)}
 className={`flex-1 py-2 text-xs font-extrabold rounded-xl uppercase tracking-wider transition-all cursor-pointer ${
 mode === m
 ? 'bg-slate-800 text-white shadow-md border border-slate-700/30'
 : 'text-slate-500 hover:text-slate-300'
 }`}
 >
 {m === 'work' ? 'Focus' : m === 'short' ? 'Short' : 'Long'}
 </button>
 ))}
 </div>

 {/* Progress Circle & Time */}
 <div className="relative w-56 h-56 mx-auto mb-8 flex items-center justify-center">
 <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 224 224">
 <circle
 cx="112"
 cy="112"
 r="98"
 className="stroke-slate-800 fill-none"
 strokeWidth="10"
 />
 <motion.circle
 cx="112"
 cy="112"
 r="98"
 className={`fill-none ${
 mode === 'work' ? 'stroke-amber-500' : mode === 'short' ? 'stroke-emerald-500' : 'stroke-sky-500'
 }`}
 strokeWidth="10"
 strokeDasharray={2 * Math.PI * 98}
 animate={{ strokeDashoffset: (2 * Math.PI * 98) * (1 - progressPercent / 100) }}
 transition={{ duration: 1, ease: 'linear' }}
 strokeLinecap="round"
 />
 </svg>
 
 <div className="z-10">
 <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white block">
 {formatTime(timeLeft)}
 </span>
 <span className={`text-[10px] font-black uppercase tracking-widest mt-1 block font-display ${modeSettings[mode].color}`}>
 {modeSettings[mode].label}
 </span>
 </div>
 </div>

 {/* Controls */}
 <div className="flex justify-center items-center gap-4">
 <button type="button"
 onClick={resetTimer}
 className="w-12 h-12 rounded-2xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-sm"
 title="Reset Timer"
 >
 <i className="fa-solid fa-rotate-left text-base"></i>
 </button>

 <button type="button"
 onClick={toggleTimer}
 className={`px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98] ${
 isActive
 ? 'bg-rose-600 hover:bg-rose-500 text-white'
 : mode === 'work'
 ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
 : mode === 'short'
 ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
 : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
 }`}
 >
 {isActive ? 'Pause' : 'Start'}
 </button>

 <div className="w-12 h-12 rounded-2xl bg-slate-850 border border-slate-800 text-slate-400 transition-all flex flex-col items-center justify-center relative">
 <span className="text-xs font-black text-white leading-none">{completedSessions}</span>
 <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-0.5">Rounds</span>
 </div>
 </div>

 </div>

 {/* TODO COLUMN */}
 <div className="md:col-span-7 bg-slate-900/45 border border-slate-800 rounded-[2rem] p-6 shadow-xl backdrop-blur-md flex flex-col h-full min-h-[400px]">
 
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <div className="w-1.5 h-4 bg-primary-500 rounded-full"></div> Focus Checklists
 </h3>
 <span className="text-xs font-semibold text-slate-500">
 {tasks.filter(t => t.completed).length} / {tasks.length} Completed
 </span>
 </div>

 {/* Add Task Input */}
 <form onSubmit={addTask} className="flex gap-2 mb-6">
 <input
 type="text"
 placeholder="What are you studying right now?"
 value={newTaskText}
 onChange={e => setNewTaskText(e.target.value)}
 className="flex-1 px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-all font-semibold"
 />
 <button
 type="submit"
 className="px-5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer shadow-md"
 >
 Add Task
 </button>
 </form>

 {/* Task Items list */}
 <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[250px] pr-1">
 <AnimatePresence initial={false}>
 {tasks.length === 0 ? (
 <div className="py-12 text-center text-slate-500 font-semibold text-xs">
 All caught up! Let's schedule some focused study targets.
 </div>
 ) : (
 tasks.map((task) => (
 <motion.div
 key={task.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, x: -10 }}
 className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
 task.completed
 ? 'bg-slate-950/40 border-slate-900 text-slate-500 line-through'
 : 'bg-slate-950/70 border-slate-800/80 text-slate-200'
 }`}
 >
 <div className="flex items-center gap-3 flex-1 mr-3 cursor-pointer" onClick={() => toggleTask(task.id)}>
 <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
 task.completed
 ? 'bg-emerald-500 border-emerald-500 text-slate-950'
 : 'border-slate-700 hover:border-slate-500'
 }`}>
 {task.completed && <i className="fa-solid fa-check text-xs"></i>}
 </div>
 <span className="text-xs font-semibold select-none leading-relaxed break-words">{task.text}</span>
 </div>

 <button type="button"
 onClick={() => deleteTask(task.id)}
 className="text-slate-500 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
 >
 <i className="fa-solid fa-trash-can text-xs"></i>
 </button>
 </motion.div>
 ))
 )}
 </AnimatePresence>
 </div>

 </div>

 </div>
 )}
 </div>

 </div>
 );
}
