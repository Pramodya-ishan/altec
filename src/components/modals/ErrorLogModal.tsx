import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, Sparkles, BookOpen, Layers, CheckCircle2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isFirebaseEnabled, db } from '../../lib/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';

interface ErrorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

export function ErrorLogModal({ isOpen, onClose, onLogged }: ErrorLogModalProps) {
  const { user, showNotification } = useApp();
  const [subject, setSubject] = useState<string>('SFT');
  const [lesson, setLesson] = useState<string>('');
  const [mistakeType, setMistakeType] = useState<string>('Conceptual');
  const [questionText, setQuestionText] = useState<string>('');
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [correctAnswer, setCorrectAnswer] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Suggested lessons based on selected subject
  const getSuggestedLessons = () => {
    if (subject === 'SFT') {
      return ['SFT Main Unit 1', 'Agro Technology', 'Food Technology', 'Bio-Systems Technology'];
    }
    if (subject === 'ET') {
      return ['Basic Electronics', 'Civil Engineering', 'Mechanical Systems', 'Electrical Technology'];
    }
    return ['Networking', 'HTML & Web Development', 'Database Management', 'Programming with Python'];
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      showNotification('Please enter the question or mistake details.', 'error');
      return;
    }

    setSaving(true);
    const newMistake = {
      subject,
      lesson: lesson.trim() || 'General Practice',
      mistakeType,
      questionText: questionText.trim(),
      userAnswer: userAnswer.trim(),
      correctAnswer: correctAnswer.trim(),
      explanation: explanation.trim() || 'No explanation provided yet.',
      repeatCount: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const email = user?.email || 'local_user';

      if (isFirebaseEnabled && db && user?.email) {
        const collRef = collection(db, 'users', email, 'mistake_notebook');
        await addDoc(collRef, newMistake);
      }

      // Save to local cache as well
      const localKey = `local_mistake_notebook_${email}`;
      const localRaw = localStorage.getItem(localKey);
      let localList = [];
      if (localRaw) {
        try {
          localList = JSON.parse(localRaw);
        } catch (e) {
          localList = [];
        }
      }
      const withId = { id: Date.now().toString(), ...newMistake };
      localList.unshift(withId);
      localStorage.setItem(localKey, JSON.stringify(localList));
      localStorage.setItem('local_mistake_notebook', JSON.stringify(localList)); // generic fallback

      showNotification('Mistake logged successfully in your Notebook!', 'success');
      
      // Reset form
      setLesson('');
      setQuestionText('');
      setUserAnswer('');
      setCorrectAnswer('');
      setExplanation('');
      
      if (onLogged) onLogged();
      onClose();
    } catch (err: any) {
      console.error('Error logging mistake:', err);
      showNotification('Failed to log mistake. Saved locally.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-lg z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-display">
                    Log a New Mistake
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saves to Mistake Notebook for AI Diagnostics
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto clora-scrollbar">
              {/* Row 1: Subject and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition"
                  >
                    <option value="SFT">Science for Tech (SFT)</option>
                    <option value="ET">Engineering Tech (ET)</option>
                    <option value="ICT">Information Tech (ICT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Mistake Type
                  </label>
                  <select
                    value={mistakeType}
                    onChange={(e) => setMistakeType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition"
                  >
                    <option value="Conceptual">Conceptual Error</option>
                    <option value="Calculation">Calculation Mistake</option>
                    <option value="Misread">Misread Question</option>
                    <option value="Time Pressure">Time Management</option>
                  </select>
                </div>
              </div>

              {/* Lesson Input & Suggestions */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Lesson / Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Basic Logic Gates"
                  value={lesson}
                  onChange={(e) => setLesson(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition"
                />
                
                {/* Suggestions Quick Buttons */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getSuggestedLessons().map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLesson(s)}
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-500 hover:text-slate-700 border border-slate-200/60 rounded-lg transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question / Mistake details */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Question or Mistake Details *</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Paste the question or write about what you got wrong..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition resize-none"
                />
              </div>

              {/* Answers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    placeholder="What did you put?"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Correct Answer
                  </label>
                  <input
                    type="text"
                    placeholder="Correct solution..."
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Explanation / Revision Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional: What is the correct way or how to avoid this next time?"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save to Notebook
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
