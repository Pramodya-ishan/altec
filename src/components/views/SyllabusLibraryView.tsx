import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { getRecommendedUploadMode } from '../../lib/uploadMode';
import { Loader2, Trash2, FileText, Upload, Layers, BookOpen, FileCheck, Plus, AlertCircle, Shield, CheckCircle2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { uploadPdfWithClientStorage, openPrivateStoragePdf, deletePrivateStorageObject } from '../../lib/clientStorageUpload';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { openSourcePdf, getPdfUrl } from '../../lib/sourceActions';
const PdfViewerModal = React.lazy(() => import('../PdfViewerModal').then(m => ({ default: m.PdfViewerModal })));

export default function SyllabusLibraryView() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'SFT' | 'ET' | 'ICT'>('ALL');
  const [form, setForm] = useState({
    title: '',
    subject: 'SFT',
    lesson: '',
    resourceType: 'syllabus',
    year: '',
    medium: 'Sinhala'
  });
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");

  const { profile } = useApp();

  useEffect(() => {
    const isSyllabusEditor = profile?.role === 'admin' || profile?.roles?.includes('admin') ||
                             profile?.role === 'teacher' || profile?.roles?.includes('teacher') ||
                             profile?.role === 'content_editor' || profile?.roles?.includes('content_editor');
    if (isSyllabusEditor) {
      setIsOwner(true);
      fetchResources();
    } else {
      setIsOwner(false);
      setLoading(false);
    }
  }, [profile]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/syllabus/resources');
      const data = await res.json().catch(()=>null);
      if (res.ok && data?.ok) {
        setResources(data.resources);
      }
    } catch (e) {
      console.warn("Failed to fetch syllabus resources", e);
    }
    setLoading(false);
  };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      // Always use client storage upload
      const uploaded = await uploadPdfWithClientStorage({
        file,
        subject: form.subject,
        lesson: form.lesson,
        resourceType: form.resourceType,
        year: form.year,
        sourceScope: 'owner_syllabus'
      });

      // Step B: Call backend ingest route
      const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title: form.title || file.name,
          fileName: file.name,
          subject: form.subject,
          lesson: form.lesson || "",
          resourceType: form.resourceType,
          sourceType: form.resourceType,
          sourceScope: "owner_syllabus",
          year: form.year || "",
          medium: form.medium || "Sinhala"
        })
      });

      let finalData = await ingestRes.json().catch(() => null);

      if (!ingestRes.ok || !finalData?.ok) {
        setUploadError(finalData?.message || finalData?.error || finalData?.code || ingestRes.statusText || "Upload ingest failed");
        setUploading(false);
        return;
      }

      setUploadResult({
        sourceId: finalData.sourceId,
        storagePath: finalData.storagePath,
        chunkCount: finalData.chunkCount,
        needsOcr: finalData.needsOcr,
        message: finalData.message
      });

      // Reset non-static parts of the form
      setForm(prev => ({ ...prev, title: '', lesson: '', year: '' }));
      fetchResources();
      setUploading(false);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Upload failed");
      setUploading(false);
    }
  };

    const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource? It will be removed from vector storage index.")) return;
    try {
      const resource = resources.find(r => r.id === id);
      const res = await apiFetch(`/api/syllabus/resources/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(()=>null);
      if (res.ok && data?.ok) {
        if (resource?.storagePath) {
          await deletePrivateStorageObject(resource.storagePath).catch((err: any) => {
            console.warn("Storage delete failed client-side (warn only):", err);
          });
        }
        setResources(r => r.filter(x => x.id !== id));
      } else {
        alert("Delete failed: " + (data?.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    }
  };

// Dynamically calculate beautiful statistics
  const stats = useMemo(() => {
    const total = resources.length;
    const sftCount = resources.filter(r => r.subject?.toUpperCase() === 'SFT').length;
    const etCount = resources.filter(r => r.subject?.toUpperCase() === 'ET').length;
    const ictCount = resources.filter(r => r.subject?.toUpperCase() === 'ICT').length;
    const totalChunks = resources.reduce((sum, r) => sum + (r.chunkCount || 0), 0);
    return { total, sftCount, etCount, ictCount, totalChunks };
  }, [resources]);

  // Filter resources based on active subject tab
  const filteredResources = useMemo(() => {
    if (activeTab === 'ALL') return resources;
    return resources.filter(r => r.subject?.toUpperCase() === activeTab);
  }, [resources, activeTab]);

  if (!isOwner) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-3xl mb-4 border border-red-100">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-sm font-semibold text-slate-500 leading-relaxed">
          Syllabus Library is restricted. Only authorized system educators or administrators can upload or index core curriculum resources.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-8">

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 font-display flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" /> Syllabus Library
          </h1>
        </div>

        <Button
          onClick={fetchResources}
          variant="secondary"
          disabled={loading}
          className="font-bold self-start md:self-auto flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <i className="fa-solid fa-arrows-rotate text-xs"></i>}
          <span>Sync Vector Store</span>
        </Button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-4 flex flex-col justify-between border-slate-200/60 shadow-sm bg-white hover:border-primary-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Indexed</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
            <span className="text-[10px] font-bold text-slate-500">PDFs</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-slate-200/60 shadow-sm bg-white hover:border-primary-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SFT Indexes</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.sftCount}</span>
            <span className="text-[10px] font-bold text-slate-500">Files</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-slate-200/60 shadow-sm bg-white hover:border-primary-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ET Indexes</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.etCount}</span>
            <span className="text-[10px] font-bold text-slate-500">Files</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between border-slate-200/60 shadow-sm bg-white hover:border-primary-300 transition-all">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ICT Indexes</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-slate-800">{stats.ictCount}</span>
            <span className="text-[10px] font-bold text-slate-500">Files</span>
          </div>
        </Card>

        <Card className="p-4 col-span-2 md:col-span-1 flex flex-col justify-between border-slate-200/60 bg-gradient-to-br from-primary-50/50 to-white hover:border-primary-300 transition-all">
          <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">Total Chunks</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-primary-700">{stats.totalChunks}</span>
            <span className="text-[10px] font-bold text-primary-500">Vectors</span>
          </div>
        </Card>
      </div>

      {/* Indexing Upload Section */}
      <Card className="p-5 sm:p-6 bg-white border border-slate-200/60 shadow-md rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 to-indigo-600"></div>

        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5">
          <Plus className="w-5 h-5 text-primary-600" /> Catalog curriculum syllabus documents
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document Title</label>
            <input
              type="text"
              placeholder="e.g. SFT 12 Unit 1 Lesson Note"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.title}
              onChange={e=>setForm({...form, title: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Subject</label>
            <select
              className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.subject}
              onChange={e=>setForm({...form, subject: e.target.value})}
            >
              <option value="SFT">SFT</option>
              <option value="ET">ET</option>
              <option value="ICT">ICT</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resource Category</label>
            <select
              className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.resourceType}
              onChange={e=>setForm({...form, resourceType: e.target.value})}
            >
              <option value="syllabus">Syllabus Curriculum</option>
              <option value="lesson_note">Lesson Note Study PDF</option>
              <option value="past_paper">Past Examination Paper</option>
              <option value="model_paper">Mock / Model Paper</option>
              <option value="marking_scheme">Official Marking Scheme</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lesson Name / Tag</label>
            <input
              type="text"
              placeholder="e.g. Bio-Systems (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.lesson}
              onChange={e=>setForm({...form, lesson: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Examination Year</label>
            <input
              type="text"
              placeholder="e.g. 2024 (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.year}
              onChange={e=>setForm({...form, year: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Medium / Language</label>
            <select
              className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500 outline-none transition-all"
              value={form.medium}
              onChange={e=>setForm({...form, medium: e.target.value})}
            >
              <option value="Sinhala">Sinhala (සිංහල)</option>
              <option value="English">English</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white text-sm font-bold rounded-xl cursor-pointer transition shadow-md active:scale-[0.98]">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Upload className="w-4 h-4 text-white" />}
            <span>{uploading ? "Analyzing & Indexing..." : "Select Document & Index"}</span>
            <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={uploading} />
          </label>
          {uploading && (
            <span className="text-xs font-semibold text-primary-600 animate-pulse">Running OCR & chunk embeddings in cloud pipeline...</span>
          )}
        </div>

        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
        {uploadResult && (
          <div className="mt-3 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs space-y-1">
            <p className="font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Upload and Index Successful!
            </p>
            <p><strong>Source ID:</strong> {uploadResult.sourceId}</p>
            <p><strong>Storage Path:</strong> {uploadResult.storagePath}</p>
            <p><strong>Chunks Indexed:</strong> {uploadResult.chunkCount}</p>
            <p><strong>Needs OCR:</strong> {uploadResult.needsOcr ? "Yes" : "No"}</p>
            <p><strong>Status:</strong> Ready</p>
            {uploadResult.message && <p className="text-amber-800 font-bold mt-1">{uploadResult.message}</p>}
          </div>
        )}
      </Card>

      {/* Segmented subject filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" /> Indexed Resources Collection
          </h2>
          <span className="text-xs font-semibold text-slate-400">Showing {filteredResources.length} elements</span>
        </div>

        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 border border-slate-200/50 w-full sm:w-[350px] shadow-inner relative">
          {(['ALL', 'SFT', 'ET', 'ICT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors z-10 cursor-pointer outline-none",
                activeTab === tab
                  ? "text-primary-700"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeFilterTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab}
            </button>
          ))}
        </div>
        {/* Resource grid table card */}
        {loading ? (
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg mb-4 w-full"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-12 bg-slate-50 rounded-lg w-1/3"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/6"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/4"></div>
                  <div className="h-12 bg-slate-50 rounded-lg w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-200/60 shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200/60">
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500">Document Title</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500">Subject</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500">Resource Category</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Embed Status</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Chunks</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-slate-500 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredResources.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-[var(--brand-600)]" />
                          </div>
                          <div className="min-w-0">
                            <p
                              onClick={() => {
                                getPdfUrl({ storagePath: r.storagePath, id: r.id, url: `/api/rag/sources/${r.id}/download` }).then(url => { setPdfUrl(url); setPdfTitle(r.title || 'Document'); setPdfModalOpen(true); }).catch((e: any) => {
                                  console.error('Download trigger failed:', e);
                                  if (e.message?.includes('LOGIN_REQUIRED')) {
                                     alert('Sign in again to open this PDF.');
                                  } else if (e.message?.includes('storage/unauthorized')) {
                                     alert('PDF access was denied. Check Storage rules, App Check, and your sign-in session.');
                                  } else if (e.message?.includes('NOT_A_PDF_RESPONSE')) {
                                     alert('The server returned an error instead of the PDF. Check the source route and authentication.');
                                  } else if (e.message?.includes('NO_OPENABLE_PDF_SOURCE')) {
                                     alert('This source has no storage path or public URL.');
                                  } else {
                                     alert('Error opening PDF: ' + e.message);
                                  }
                                });
                              }}
                              className={cn(
                                "font-bold text-slate-800 truncate text-[14px]",
                                r.storagePath ? "hover:text-primary-600 hover:underline cursor-pointer" : ""
                              )}
                            >
                              {r.title}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400">
                              {r.medium || 'Sinhala'} • {r.year ? `${r.year} Examination` : 'Curriculum File'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/60">
                          {r.subject}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-semibold text-slate-600 capitalize">
                          {r.resourceType?.replace('_', ' ') || 'Syllabus Doc'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {r.status === 'processed' || r.status === 'ready' || r.indexStatus === 'ready' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Processed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> {r.status || r.indexStatus || 'indexing'}
                            </span>
                          )}
                          {r.needsOcr && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded">
                              OCR
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center font-mono text-xs font-bold text-slate-600">
                        {r.chunkCount || 0}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          aria-label="Delete indexed resource"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredResources.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-500">No resources matched the selected subject filter.</p>
                          <p className="text-xs font-semibold text-slate-400 mt-1">Syllabus PDF files and notes uploaded by the owner will show up here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      {pdfModalOpen && (
        <React.Suspense fallback={null}>
          <PdfViewerModal
            isOpen={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            pdfUrl={pdfUrl}
            title={pdfTitle}
          />
        </React.Suspense>
      )}
    </div>
  );
}
