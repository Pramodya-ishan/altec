import { apiFetch } from "../../lib/api";
import React, { useState, useEffect } from 'react';
import { useApp, UserProfile } from '../../context/AppContext';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseEnabled } from '../../lib/firebase';
import { getAllVideoKeys, deleteVideoFile, clearAllVideoFiles } from '../../lib/indexedDB';
import { SYLLABUS } from '../../constants/syllabus';
import { calculateLessonWiseMarks } from '../../lib/scoreUtils';

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
export default function ProfileView() {
 const {
 user,
 profile,
 saveProfile,
 adminTargetEmail,
 setAdminTargetEmail,
 data,
 saveData,
 showNotification
 } = useApp();

 const [isEditing, setIsEditing] = useState(false);
 const [editUsername, setEditUsername] = useState(profile?.username || '');
 const [editBio, setEditBio] = useState(profile?.bio || '');
 const [editPicture, setEditPicture] = useState(profile?.picture || user?.picture || '');

 const [apiUsage, setApiUsage] = useState({ rpm: 0, rpd: 0, rpmLimit: 15, rpdLimit: 1500 });
 const [adminInput, setAdminInput] = useState('');
  const { setCurrentView } = useApp();
  const handleAskCloraZScore = () => {
     // Switch view to clora and send message
     setCurrentView('clora-x');
     // To actually send the message we'd need a global event or context, but just switching view is okay for now, or we can use custom event
     window.dispatchEvent(new CustomEvent('clora-send', { detail: 'mage zscore eka kiyanna' }));
  };


 const [showRawEditor, setShowRawEditor] = useState(false);
 const [rawJsonData, setRawJsonData] = useState('');
 const [rawEditorStatus, setRawEditorStatus] = useState('');

 // Local storage telemetry metric states
 const [storageUsage, setStorageUsage] = useState<number | null>(null);
 const [storageQuota, setStorageQuota] = useState<number | null>(null);
 const [videoFilesCount, setVideoFilesCount] = useState<number>(0);
 const [orphanCount, setOrphanCount] = useState<number>(0);
 const [isCleaning, setIsCleaning] = useState<boolean>(false);

 const handleExportData = () => {
 try {
 const sftLessons = calculateLessonWiseMarks('sft', data?.sft);
 const etLessons = calculateLessonWiseMarks('et', data?.et);
 const ictLessons = calculateLessonWiseMarks('ict', data?.ict);

 const campusZScores_ref = [
 {
 stream: "Engineering Technology Stream",
 degrees: [
 { degree: "Bachelor of Engineering Technology Hons (BET) - USJ", minZ: 1.60, maxZ: 1.75 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Kelaniya", minZ: 1.55, maxZ: 1.65 },
 { degree: "BET (Instrumentation & Automation Hons) - Colombo", minZ: 1.40, maxZ: 1.55 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Ruhuna", minZ: 1.35, maxZ: 1.45 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Wayamba", minZ: 1.25, maxZ: 1.35 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Sabaragamuwa", minZ: 1.20, maxZ: 1.30 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Rajarata", minZ: 1.15, maxZ: 1.25 },
 { degree: "BET (Mechanical Engineering Technology) - Uva Wellassa", minZ: 1.10, maxZ: 1.20 },
 { degree: "Bachelor of Engineering Technology Hons (BET) - Jaffna", minZ: 0.85, maxZ: 1.05 }
 ]
 },
 {
 stream: "Information Technology & Systems Stream",
 degrees: [
 { degree: "BSc in Information Technology (IT) - Moratuwa", minZ: 1.55, maxZ: 1.75 },
 { degree: "BSc in Information Systems (IS) - Colombo UCSC & USJ", minZ: 1.45, maxZ: 1.65 },
 { degree: "Bachelor of Information & Communication Technology (BICT) - State Universities", minZ: 1.15, maxZ: 1.35 }
 ]
 },
 {
 stream: "Management & Design Streams",
 degrees: [
 { degree: "Food Business Management - Wayamba", minZ: 1.15, maxZ: 1.30 },
 { degree: "Human Resource Development - State Uni", minZ: 1.05, maxZ: 1.20 },
 { degree: "Design (Aptitude req.) - Moratuwa", minZ: 1.05, maxZ: 1.25 },
 { degree: "Fashion Design & Product Development - Moratuwa", minZ: 1.00, maxZ: 1.20 }
 ]
 }
 ];

 const aiInstructions_text = `You are the AI, the advanced GCE Advanced Level AI Academic Supervisor. This JSON file contains the complete learning bio, syllabus milestones, and quiz results of the student named @${profile?.username || 'Student'}. Please ingest the 'subjectLessons' and current estimated ranks to Formulate a daily study plan for SFT, ET, and ICT based on weak topics, pay extremely close attention to the high-yield MCQ lessons whose completion status is false, and aim to elevate the student's predicted Z-Score to match their desired campusZScores cut-off goals.`;

 const processSubjectLessons = (subjKey: 'sft' | 'et' | 'ict', lessonWiseDetails: any) => {
 const subjectData = data?.[subjKey] as any || {};
 const questionMarksObj = subjectData.questionMarks || {};

 return Object.keys(lessonWiseDetails).map(topicName => {
 const stats = lessonWiseDetails[topicName];
 const studentAttempts = questionMarksObj[topicName] || [];

 const mcqScores = studentAttempts.map((attempt: any) => {
 const rawScore = attempt.mcqRaw !== undefined ? attempt.mcqRaw : (attempt.mcqPer !== undefined ? attempt.mcqPer : 0);

 let letterGrade = 'F';
 if (rawScore >= 75) letterGrade = 'A';
 else if (rawScore >= 65) letterGrade = 'B';
 else if (rawScore >= 55) letterGrade = 'C';
 else if (rawScore >= 35) letterGrade = 'S';

 return {
 assessmentTitle: attempt.title || 'Practice Test',
 year: attempt.year || 'N/A',
 rawPercentage: rawScore,
 letterGrade,
 timeSpentSeconds: attempt.time || 0
 };
 });

 const maxZContrib = 1.0;
 const currentZContrib = stats.isCompleted ? (stats.totalMarks / 100) * maxZContrib : 0;

 return {
 lesson: topicName,
 isCompleted: stats.isCompleted,
 lessonSyllabusWeights: {
 mcqMarksWeight: stats.mcqMarks,
 structuredEssayMarksWeight: stats.structuredEssayMarks,
 essayMarksWeight: stats.essayMarks,
 totalLessonMarksWeight: stats.totalMarks
 },
 studentQuizPerformanceLog: mcqScores,
 currentEstimatedZScoreContribution: Number(currentZContrib.toFixed(4))
 };
 });
 };

 const exportPayload = {
 metadata: {
 exportTimestamp: new Date().toISOString(),
 studentUsername: profile?.username || 'Guest',
 studentEmail: profile?.email || 'N/A'
 },
 firebaseData: {
 profile: profile || {},
 appPreferences: {
 theme: (data as any)?.theme || 'blue',
 collapsedStates: data?.collapsedStates || {}
 },
 zScorePerformanceRecord: {
 targetZScore: data?.targetZ || 1.85,
 historyPoints: data?.zScoreHistory || []
 }
 },
 subjectLessons: {
 sft: processSubjectLessons('sft', sftLessons),
 et: processSubjectLessons('et', etLessons),
 ict: processSubjectLessons('ict', ictLessons)
 },
 campusZScores: campusZScores_ref,
 aiInstructions: aiInstructions_text.trim()
 };

 const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `GCE_AL_Blueprint_${profile?.username || 'Student'}_FullData.json`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);

 showNotification("Analytical blueprint dataset downloaded successfully!", "success");
 } catch (e: any) {
 console.error(e);
 showNotification("Failed to export. Error: " + e.message, "error");
 }
 };

 const formatBytes = (bytes: number | null): string => {
 if (bytes === null || bytes === undefined) return '0 B';
 if (bytes === 0) return '0 B';
 const k = 1024;
 const dm = 2;
 const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
 };

 const loadStorageStats = async () => {
 try {
 if (navigator.storage && navigator.storage.estimate) {
 const estimate = await navigator.storage.estimate();
 if (estimate.usage !== undefined) setStorageUsage(estimate.usage);
 if (estimate.quota !== undefined) setStorageQuota(estimate.quota);
 }

 const keys = await getAllVideoKeys();
 setVideoFilesCount(keys.length);

 const referencedIds = new Set<string>();
 ['sft', 'et', 'ict'].forEach((subKey) => {
 const subject = (data as any)[subKey];
 if (subject && subject.topics) {
 Object.values(subject.topics).forEach((topicObj: any) => {
 if (topicObj && Array.isArray(topicObj.videos)) {
 topicObj.videos.forEach((video: any) => {
 if (video && typeof video.url === 'string' && video.url.startsWith('localdb://')) {
 const id = video.url.replace('localdb://', '');
 if (id) referencedIds.add(id);
 }
 });
 }
 });
 }
 });

 let orphans = 0;
 keys.forEach((key) => {
 if (!referencedIds.has(key)) orphans++;
 });
 setOrphanCount(orphans);
 } catch (err) {
 console.warn("Error reading storage stats:", err);
 }
 };

 const handleCleanOrphans = async () => {
 setIsCleaning(true);
 try {
 const keys = await getAllVideoKeys();
 const referencedIds = new Set<string>();
 ['sft', 'et', 'ict'].forEach((subKey) => {
 const subject = (data as any)[subKey];
 if (subject && subject.topics) {
 Object.values(subject.topics).forEach((topicObj: any) => {
 if (topicObj && Array.isArray(topicObj.videos)) {
 topicObj.videos.forEach((video: any) => {
 if (video && typeof video.url === 'string' && video.url.startsWith('localdb://')) {
 const id = video.url.replace('localdb://', '');
 if (id) referencedIds.add(id);
 }
 });
 }
 });
 }
 });

 let cleaned = 0;
 for (const key of keys) {
 if (!referencedIds.has(key)) {
 await deleteVideoFile(key);
 cleaned++;
 }
 }
 showNotification(`Successfully deleted ${cleaned} orphaned cache file(s). Space reclaimed!`, 'success');
 await loadStorageStats();
 } catch (e) {
 showNotification('Clean command failed.', 'error');
 } finally {
 setIsCleaning(false);
 }
 };

 const [confirmClearVideos, setConfirmClearVideos] = useState(false);

 const handleClearAllVideos = async () => {
 if (!confirmClearVideos) {
 setConfirmClearVideos(true);
 setTimeout(() => setConfirmClearVideos(false), 4000);
 return;
 }
 setConfirmClearVideos(false);
 setIsCleaning(true);
 try {
 await clearAllVideoFiles();
 showNotification('Device offline file storage has been fully purged.', 'success');
 await loadStorageStats();
 } catch (e) {
 showNotification('Purge command failed.', 'error');
 } finally {
 setIsCleaning(false);
 }
 };

 const fetchRawData = async () => {
 if (!adminInput.trim() || !isFirebaseEnabled || !db) {
 setRawEditorStatus('Cannot fetch. Check email and Firebase config.');
 return;
 }
 setRawEditorStatus('Loading raw user data...');
 try {
 const docRef = doc(db, 'users', adminInput.trim(), 'data', 'al_blueprint_state');
 const snap = await getDoc(docRef);
 if (snap.exists()) {
 setRawJsonData(JSON.stringify(snap.data(), null, 2));
 setRawEditorStatus('Loaded securely.');
 } else {
 setRawJsonData('{}');
 setRawEditorStatus('Document does not exist (default to {})');
 }
 setShowRawEditor(true);
 } catch(err: any) {
 setRawEditorStatus('Error: ' + err.message);
 }
 };

 const saveRawData = async () => {
 try {
 setRawEditorStatus('Saving to Firebase...');
 const parsed = JSON.parse(rawJsonData);
 const docRef = doc(db, 'users', adminInput.trim(), 'data', 'al_blueprint_state');
 await setDoc(docRef, parsed);
 setRawEditorStatus('Overwrite successful!');
 } catch(err: any) {
 setRawEditorStatus('Format Error or Permission Error: ' + err.message);
 }
 };

 const handleAdminSwitch = () => {
 if (adminInput.trim()) {
 setAdminTargetEmail(adminInput.trim());
 } else {
 setAdminTargetEmail(null);
 }
 };

 useEffect(() => {
 const updateUsage = async () => {
 try {
 const res = await apiFetch('/api/quota');
 if (res.ok) {
 const data = await res.json();
 setApiUsage({ rpm: data.rpmUsed, rpd: data.rpdUsed, rpmLimit: data.rpmLimit, rpdLimit: data.rpdLimit });
 }
 } catch(e) {}
 };
 updateUsage();
 loadStorageStats();
 const interval = setInterval(updateUsage, 5000);
 return () => clearInterval(interval);
 }, []);

 const handleEditInit = () => {
 if (profile) {
 setEditUsername(profile.username);
 setEditBio(profile.bio);
 setEditPicture(profile.picture || user?.picture || '');
 }
 setIsEditing(true);
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!profile) return;
 const finalPic = editPicture || user?.picture || profile.picture || '';
 const updated: UserProfile = {
 ...profile,
 username: editUsername.trim() !== '' ? editUsername : profile.username,
 bio: editBio.trim() !== '' ? editBio : profile.bio,
 picture: finalPic,
 updatedAt: new Date().toISOString(),
 };
 await saveProfile(updated);
 setIsEditing(false);
 };

 const profilePicture = profile?.picture || user?.picture || '';
 const profileInitial = (profile?.username || user?.name || user?.email || 'T').trim().charAt(0).toUpperCase();

 return (
 <div id="profile-dashboard-view" className="max-w-2xl mx-auto flex flex-col gap-8">
 {/* User Profile Details */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.3 }}
 className="bg-white rounded-[2rem] border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden"
 >
 {/* Accent decoration in background */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />

 <div className="flex flex-col items-center text-center">
 {/* Avatar block */}
 <div className="relative group mb-5">
 <div className="absolute inset-0 bg-primary-500 rounded-full blur-sm opacity-20 scale-105 group-hover:opacity-30 transition-opacity" />
 <div className="relative z-10 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-900 text-3xl font-bold text-white shadow-md" aria-label="Profile photo">
 <span aria-hidden="true">{profileInitial}</span>
 {profilePicture && (
 <img
 src={profilePicture}
 alt={`${profile?.username || user?.name || 'User'} profile`}
 className="absolute inset-0 h-full w-full object-cover"
 referrerPolicy="no-referrer"
 loading="eager"
 fetchPriority="high"
 onError={(event) => { event.currentTarget.hidden = true; }}
 />
 )}
 </div>
 {!isEditing && (
 <button
 onClick={handleEditInit}
 className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center border-2 border-white shadow hover:bg-primary-700 transition-colors z-20 cursor-pointer "
 title="Modify Profile"
 >
 <i className="fa-solid fa-pen text-xs"></i>
 </button>
 )}
 </div>

 {/* Profile Info Fields */}
 {!isEditing ? (
 <div className="w-full">
 <h2 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight flex justify-center items-center gap-2">
 @{profile?.username}
 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
 Active Student
 </span>
 </h2>
 <p className="text-xs text-slate-500 font-medium mb-3">{profile?.email || 'Offline Sandbox Mode'}</p>

 {/* Authentication Status / Verified Badge */}
 <div className="flex justify-center mb-5">
 {user ? (
 <span id="auth-status-badge" className={cn(
 "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10.5px] font-black border shadow-sm transition-all uppercase tracking-wider",
 user.emailVerified !== false
 ? "bg-emerald-50 text-emerald-800 border-emerald-200"
 : "bg-amber-50 text-amber-800 border-amber-200"
 )}>
 <i className={cn(
 "fa-solid",
 user.emailVerified !== false ? "fa-circle-check text-emerald-600" : "fa-triangle-exclamation text-amber-600"
 )}></i>
 {user.emailVerified !== false ? "Verified Email Access" : "Unverified Account Path"}
 </span>
 ) : (
 <span id="auth-status-badge" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10.5px] font-black bg-slate-50 text-slate-600 border border-slate-200 shadow-sm uppercase tracking-wider">
 <i className="fa-solid fa-circle-exclamation text-slate-400"></i>
 Sandbox Mode (Unlogged)
 </span>
 )}
 </div>

 <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 text-left">
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Learning Bio</span>
 <p className="text-slate-700 text-sm font-semibold leading-relaxed italic">
 "{profile?.bio || 'No bio written yet. Click edit to write one!'}"
 </p>
 </div>
 </div>
 ) : (
 /* Profile Editing Form */
 <form onSubmit={handleSave} className="w-full text-left">
 <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
 <h3 className="font-display font-extrabold text-slate-800 text-base">Edit Profile Form</h3>
 <button
 type="button"
 onClick={() => setIsEditing(false)}
 className="text-xs text-slate-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
 >
 Cancel
 </button>
 </div>

 <div className="mb-4">
 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
 Username
 </label>
 <input
 type="text"
 required
 value={editUsername}
 onChange={(e) => setEditUsername(e.target.value)}
 className="w-full text-sm font-semibold p-3 border border-slate-200 rounded-xl bg-white focus:border-primary-600 outline-none"
 placeholder="Enter username..."
 />
 </div>

 <div className="mb-4">
 <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
 Bio Description
 </label>
 <textarea
 rows={3}
 maxLength={160}
 value={editBio}
 onChange={(e) => setEditBio(e.target.value)}
 className="w-full text-sm font-semibold p-3 border border-slate-200 rounded-xl bg-white focus:border-primary-600 outline-none resize-none"
 placeholder="Write a brief learning bio..."
 />
 <div className="text-right text-[10px] text-slate-400 font-semibold mt-1">
 {editBio.length}/160 characters
 </div>
 </div>

 <div className="mb-5">
 <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Profile photo</label>
 <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
 <button
 type="button"
 onClick={() => setEditPicture(user?.picture || profile?.picture || '')}
 className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white p-2 text-left ring-1 ring-slate-200 transition hover:ring-slate-300"
 >
 <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-600">
 {(user?.picture || profile?.picture) ? <img src={user?.picture || profile?.picture} alt="Google account" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (profile?.username || user?.name || 'S').charAt(0).toUpperCase()}
 </span>
 <span className="min-w-0"><strong className="block truncate text-sm text-slate-800">Google account photo</strong><span className="text-xs text-slate-500">Use your signed-in account image</span></span>
 </button>
 <label className="flex h-16 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-800" title="Upload a photo">
 <i className="fa-solid fa-arrow-up-from-bracket text-sm"></i>
 <span className="mt-1 text-[9px] font-bold uppercase">Upload</span>
 <input
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = (evt) => {
 if (evt.target?.result) {
 setEditPicture(evt.target.result as string);
 }
 };
 reader.readAsDataURL(file);
 }
 }}
 />
 </label>
 </div>
 </div>

 <button
 type="submit"
 className="w-full py-3.5 bg-primary-600 text-white font-extrabold text-sm rounded-xl hover:bg-primary-700 active:scale-95 transition-all shadow-sm cursor-pointer border-b-4 border-primary-800"
 >
 <i className="fa-solid fa-cloud-arrow-up mr-2"></i> Save Profile Details
 </button>
 </form>
 )}
 </div>
 </motion.div>

 {/* 📥 EXPORT FULL BluePrint DATASET */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.3, delay: 0.05 }}
 className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden text-left "
 >
 <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />

 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex items-start gap-4 text-left">
 <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
 <i className="fa-solid fa-file-export text-emerald-600 text-lg"></i>
 </div>
 <div>
 <h3 className="font-display font-black text-slate-900 text-base sm:text-lg tracking-tight">
 Analytical Blueprint Export Hub
 </h3>
 <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
 Download your complete GCE A/L interactive learning record. Includes subject wise lesson checklists, MCQ Option distributions, Z-scores, university bounds, and AI tutor directives.
 </p>
 </div>
 </div>

 <button
 onClick={handleExportData}
 className="w-full md:w-auto px-6 py-4 bg-emerald-500 hover:bg-emerald-600 font-extrabold text-sm rounded-xl text-white transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
 >
 <i className="fa-solid fa-file-arrow-down text-base"></i>
 Export Dataset
 </button>
 </div>
 </motion.div>

 {/* 🧹 Local Cache and Service Worker Controller */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.3, delay: 0.1 }}
 className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden text-left"
 >
 <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-400 to-amber-500" />

 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex items-start gap-4 text-left">
 <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
 <i className="fa-solid fa-trash-can text-red-600 text-lg"></i>
 </div>
 <div>
 <h3 className="font-display font-black text-slate-900 text-base sm:text-lg tracking-tight">
 Application Cache & Service Worker Purge
 </h3>
 <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
 If you are experiencing offline sync or page loading anomalies, you can clear all service worker registrations, purge local HTTP/Workbox caches, and force refresh the page.
 </p>
 </div>
 </div>

 <button
 type="button"
 onClick={() => {
   if (typeof window !== 'undefined') {
     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.getRegistrations().then(regs => {
         regs.forEach(r => r.unregister());
       });
     }
     if (typeof caches !== 'undefined') {
       caches.keys().then(keys => {
         Promise.all(keys.map(k => caches.delete(k))).then(() => {
           window.location.reload();
         });
       });
     } else {
       window.location.reload();
     }
   }
 }}
 className="w-full md:w-auto px-6 py-4 bg-red-500 hover:bg-red-600 font-extrabold text-sm rounded-xl text-white transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
 >
 <i className="fa-solid fa-arrows-rotate text-base"></i>
 Clear app cache & reload
 </button>
 </div>
 </motion.div>

 </div>
 );
}
