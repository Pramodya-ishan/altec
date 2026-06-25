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

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nuwan',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Dilshan',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Amara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Kavindi',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Awantha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Saman',
];

export function ProfileView() {
  const {
    user,
    profile,
    saveProfile,
    adminTargetEmail,
    setAdminTargetEmail,
    data,
    showNotification
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editPicture, setEditPicture] = useState(profile?.picture || PRESET_AVATARS[0]);
  const [customPicUrl, setCustomPicUrl] = useState('');

  const [apiUsage, setApiUsage] = useState({ rpm: 0, rpd: 0, rpmLimit: 15, rpdLimit: 1500 });
  const [adminInput, setAdminInput] = useState('');

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

      const aiInstructions_text = `You are 1st Edition, the advanced GCE Advanced Level AI Academic Supervisor. This JSON file contains the complete learning bio, syllabus milestones, and quiz results of the student named @${profile?.username || 'Student'}. Please ingest the 'subjectLessons' and current estimated ranks to Formulate a daily study plan for SFT, ET, and ICT based on weak topics, pay extremely close attention to the high-yield MCQ lessons whose completion status is false, and aim to elevate the student's predicted Z-Score to match their desired campusZScores cut-off goals.`;

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
      showNotification(`Successfully deleted ${cleaned} orphaned cache video file(s). Space reclaimed!`, 'success');
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
      showNotification('Device offline video storage has been fully purged.', 'success');
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
      setEditPicture(profile.picture);
    }
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const finalPic = customPicUrl.trim() !== '' ? customPicUrl.trim() : editPicture;
    const updated: UserProfile = {
      ...profile,
      username: editUsername.trim() !== '' ? editUsername : profile.username,
      bio: editBio.trim() !== '' ? editBio : profile.bio,
      picture: finalPic,
      updatedAt: new Date().toISOString(),
    };
    await saveProfile(updated);
    setIsEditing(false);
    setCustomPicUrl('');
  };

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
            <img
              src={profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profile?.username || 'LocalStudent')}`}
              alt="Avatar"
              className="w-28 h-28 rounded-full border-4 border-white shadow-md relative z-10 bg-slate-50 object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=LocalStudent`;
              }}
            />
            {!isEditing && (
              <button
                onClick={handleEditInit}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center border-2 border-white shadow hover:bg-primary-700 transition-colors z-20 cursor-pointer animate-in fade-in zoom-in-50 duration-200"
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
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Choose Preset Avatar to upload avatar
                </label>
                <div className="flex flex-wrap gap-2.5 mb-3">
                  {PRESET_AVATARS.map((pic, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEditPicture(pic);
                        setCustomPicUrl('');
                      }}
                      className={cn(
                        "w-12 h-12 rounded-full overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 bg-slate-50 cursor-pointer",
                        editPicture === pic && customPicUrl === '' ? "border-primary-600 scale-110 shadow-sm" : "border-slate-200"
                      )}
                    >
                      <img src={pic} alt="Preset" className="w-full h-full" />
                    </button>
                  ))}
                  
                  {/* File upload selector disguised as a preset button */}
                  <label className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 hover:border-primary-500 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm" title="Upload Custom File">
                    <i className="fa-solid fa-arrow-up-from-bracket text-slate-400 text-xs text-center"></i>
                    <span className="text-[7px] font-black uppercase text-slate-400 mt-0.5 leading-none">Upload</span>
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
                              setCustomPicUrl('');
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Or Enter Custom Profile Pic URL
                </label>
                <input
                  type="url"
                  value={customPicUrl}
                  onChange={(e) => {
                    setCustomPicUrl(e.target.value);
                    setEditPicture('');
                  }}
                  placeholder="https://example.com/avatar.png"
                  className="w-full text-xs font-semibold p-3 border border-slate-200 rounded-xl bg-white focus:border-primary-600 outline-none"
                />
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
        className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden text-left animate-in fade-in duration-300"
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
                Download your complete GCE A/L interactive learning record. Includes subject wise lesson checklists, MCQ Option distributions, Z-scores, university bounds, and 1st Edition tutor directives.
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

      {/* EXPORT / IMPORT RAW JSON BACKUP */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-sm p-8 relative overflow-hidden text-left animate-in fade-in duration-300 mt-6"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-400 to-purple-500" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4 text-left">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-database text-indigo-600 text-lg"></i>
            </div>
            <div>
              <h3 className="font-display font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Raw App Data Backup Sync
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
                Export and Import your raw AppData JSON file. Imported files will be instantly synced and saved to Firebase Firestore.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:w-auto w-full">
            <button
              onClick={() => {
                try {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `GCE_AL_Raw_AppData_${profile?.username || 'Backup'}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  showNotification("Raw data exported successfully!", "success");
                } catch(e: any) {
                  showNotification("Export failed: " + e.message, "error");
                }
              }}
              className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-download text-base"></i>
              Export Raw
            </button>
            <label
              className="w-full sm:w-auto px-6 py-4 bg-indigo-500 hover:bg-indigo-600 font-extrabold text-sm rounded-xl text-white transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-upload text-base"></i>
              Import JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (evt) => {
                    try {
                      const jsonStr = evt.target?.result as string;
                      const parsed = JSON.parse(jsonStr);
                      if (parsed && typeof parsed === 'object') {
                         await saveData(parsed);
                         showNotification("Data imported and saved to Firebase successfully!", "success");
                         window.location.reload();
                      } else {
                         throw new Error("Invalid json object");
                      }
                    } catch(err: any) {
                      showNotification("Failed to import JSON: " + err.message, "error");
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </motion.div>

      {/* API Usage Metrics Dashboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white rounded-[2rem] border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
             <i className="fa-solid fa-server text-slate-500"></i>
           </div>
           <div>
             <h3 className="font-display font-bold text-slate-800 text-lg">API Usage Metrics</h3>
             <p className="text-xs text-slate-500 font-medium tracking-wide">Real-time server capacity</p>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {/* Per minute */}
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Requests Per Min</span>
                 <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Target: {apiUsage.rpmLimit} RPM</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                 <span className="text-3xl font-display font-black text-slate-800 leading-none">{apiUsage.rpm}</span>
                 <span className="text-sm font-bold text-slate-400 mb-1">/ {apiUsage.rpmLimit}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (apiUsage.rpm / apiUsage.rpmLimit) * 100)}%` }}></div>
              </div>
           </div>
           
           {/* Daily limit */}
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Free Tier (Daily)</span>
                 <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{apiUsage.rpdLimit} RPD</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                 <span className="text-3xl font-display font-black text-slate-800 leading-none">{apiUsage.rpd}</span>
                 <span className="text-sm font-bold text-slate-400 mb-1">/ {apiUsage.rpdLimit}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                 <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (apiUsage.rpd / apiUsage.rpdLimit) * 100)}%` }}></div>
              </div>
           </div>
        </div>
        <div className="mt-4 text-[10px] text-slate-400 font-medium text-center italic">
          Note: Tracked directly from the 1st Edition queue.
        </div>
      </motion.div>

      {/* Dynamic Browser Cache & Video Storage Dashboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-white rounded-[2rem] border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
               <i className="fa-solid fa-hard-drive text-slate-500"></i>
             </div>
             <div>
               <h3 className="font-display font-bold text-slate-800 text-lg">Local Cache & Offline Video Storage</h3>
               <p className="text-xs text-slate-500 font-medium tracking-wide">Manage on-device IndexedDB footprint</p>
             </div>
          </div>
          <button
             onClick={loadStorageStats}
             className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 border border-slate-200"
          >
             <i className="fa-solid fa-arrows-rotate mr-1"></i> Refresh Stats
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Estimated Disk Space</p>
              <p className="text-2xl font-black text-slate-800 leading-none mb-1">{formatBytes(storageUsage)}</p>
              <p className="text-[9px] font-semibold text-slate-400">out of {formatBytes(storageQuota)} quota</p>
           </div>
           
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Cached Videos</p>
              <p className="text-2xl font-black text-primary-600 leading-none mb-1">{videoFilesCount}</p>
              <p className="text-[9px] font-semibold text-slate-400">active downloaded mp4/lecture files</p>
           </div>

           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Orphaned Caches</p>
              <p className="text-2xl font-black text-amber-600 leading-none mb-1">{orphanCount}</p>
              <p className="text-[9px] font-semibold text-slate-400">leaked files not linked to playlists</p>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
           {orphanCount > 0 ? (
              <button
                 onClick={handleCleanOrphans}
                 disabled={isCleaning}
                 className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all border-b-4 border-amber-700 disabled:opacity-50 cursor-pointer"
              >
                 <i className="fa-solid fa-broom mr-2"></i> Clean {orphanCount} Orphaned Videos ({formatBytes(storageUsage)})
              </button>
           ) : (
              <button
                 disabled
                 className="flex-1 py-3 bg-slate-100 text-slate-400 text-xs font-black uppercase tracking-wider rounded-xl border border-slate-200 cursor-not-allowed"
              >
                 <i className="fa-solid fa-circle-check mr-2"></i> Local Cache is Fully Optimized
              </button>
           )}

           <button
              onClick={handleClearAllVideos}
              disabled={isCleaning || videoFilesCount === 0}
              className={`px-5 py-3 ${confirmClearVideos ? "bg-red-500 hover:bg-red-600 text-white" : "bg-red-50 hover:bg-red-100 text-red-600"} active:scale-[0.98] text-xs font-black uppercase tracking-wider rounded-xl transition-all ${confirmClearVideos ? "border-transparent" : "border border-red-200"} disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
           >
              <i className={isCleaning ? "fa-solid fa-spinner fa-spin mr-2" : "fa-solid fa-trash-can mr-2"}></i> {confirmClearVideos ? "Click Again To Purge" : "Wipe Video Cache"}
           </button>
        </div>

        <p className="mt-4 text-[10px] text-slate-400 font-medium text-center">
           Note: Video and lecture files are stored directly in your browser's private database (IndexedDB) for offline playback.
        </p>
      </motion.div>

      {/* Admin Panel has been moved to AdminDashboardView */}
    </div>
  );
}
