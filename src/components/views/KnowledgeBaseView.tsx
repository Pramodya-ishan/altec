import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, Upload, Trash2, FileText, Activity } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { uploadPdfWithClientStorage } from '../../lib/clientStorageUpload';

export function KnowledgeBaseView() {
  const { user, showNotification } = useApp();
  const [sources, setSources] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [uploading, setUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('sft');
  const [sourceType, setSourceType] = useState('note');
  const [year, setYear] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sourcesRes, statsRes] = await Promise.all([
        apiFetch('/api/rag/sources'),
        apiFetch('/api/rag/debug')
      ]);
      const sourcesData = await sourcesRes.json();
      const statsData = await statsRes.json();
      if (sourcesData.ok) setSources(sourcesData.sources);
      if (statsData.ok) setStats(statsData.stats);
    } catch (e: any) {
      showNotification('Failed to load knowledge base: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const handleReindex = async (sourceId: string) => {
    setReindexingId(sourceId);
    showNotification('OCR Reindexing started. This may take up to a minute...', 'info');
    try {
      const res = await apiFetch('/api/rag/reindex-uploaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showNotification(`Successfully reindexed source. Created ${data.chunkCount} parts.`, 'success');
        fetchData();
      } else {
        showNotification(data.error || 'Reindexing failed', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setReindexingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      showNotification('Please provide a file and a title.', 'error');
      return;
    }
    
    setUploading(true);
    showNotification('Processing PDF... This may take a minute.', 'info');
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        const res = await apiFetch('/api/rag/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            subject,
            sourceType,
            year: year || undefined,
            fileName: file.name,
            pdfBase64: base64
          })
        });
        
        let data = await res.json().catch(() => null);
        let isFallback = false;

        if (!res.ok || data?.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" || data?.code === "UPLOAD_STORAGE_FAILED" || (data?.message && (data.message.includes("oauth2") || data.message.includes("Premature close")))) {
          console.warn("Backend upload failed. Trying client fallback upload...");
          isFallback = true;
        }

        if (isFallback) {
          const uploaded = await uploadPdfWithClientStorage({
            file,
            subject: subject,
            year: year || undefined,
            resourceType: sourceType,
            sourceScope: "owner_syllabus"
          });

          const payload = {
            sourceId: uploaded.sourceId,
            storagePath: uploaded.storagePath,
            downloadUrl: uploaded.downloadUrl,
            title: title || file.name,
            fileName: file.name,
            subject: subject,
            resourceType: sourceType,
            sourceType: sourceType,
            sourceScope: "owner_syllabus",
            year: year || "",
            medium: "Sinhala"
          };

          const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          data = await ingestRes.json().catch(() => null);
          if (!ingestRes.ok || !data?.ok) {
            showNotification(data?.message || data?.error || "Upload ingest failed", "error");
            setUploading(false);
            return;
          }
        } else {
          if (!res.ok || !data?.ok) {
            showNotification(data?.error || data?.message || 'Upload failed', 'error');
            setUploading(false);
            return;
          }
        }

        showNotification(`Successfully uploaded and chunked ${data.chunkCount} parts.`, 'success');
        setFile(null);
        setTitle('');
        setYear('');
        fetchData();
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      showNotification(e.message, 'error');
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;
    try {
      const res = await apiFetch(`/api/rag/sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        showNotification('Source deleted.', 'success');
        fetchData();
      } else {
        showNotification(data.error || 'Failed to delete.', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-gray-400">Manage RAG sources, PDFs, and notes for Clora X.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              Upload Source
            </h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500" 
                  placeholder="e.g. SFT 2024 Marking Scheme" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subject</label>
                  <select 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)} 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="sft">SFT</option>
                    <option value="et">ET</option>
                    <option value="ict">ICT</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select 
                    value={sourceType} 
                    onChange={e => setSourceType(e.target.value)} 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  >
                    <option value="note">My Note</option>
                    <option value="past_paper">Past Paper</option>
                    <option value="marking_scheme">Marking Scheme</option>
                    <option value="syllabus">Syllabus</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Year (Optional)</label>
                <input 
                  type="number" 
                  value={year} 
                  onChange={e => setYear(e.target.value)} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500" 
                  placeholder="2024" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">PDF File</label>
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={handleFileChange} 
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={uploading} 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {uploading ? 'Processing...' : 'Upload & Ingest'}
              </button>
            </form>
          </div>

          {stats && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                RAG Statistics
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Total Sources</div>
                  <div className="text-xl font-bold text-white">{stats.sourcesCount}</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Total Chunks</div>
                  <div className="text-xl font-bold text-white">{stats.chunksCount}</div>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                <div className="flex justify-between mb-1"><span>SFT Sources:</span> <span className="text-white">{stats.bySubject?.sft || 0}</span></div>
                <div className="flex justify-between mb-1"><span>ET Sources:</span> <span className="text-white">{stats.bySubject?.et || 0}</span></div>
                <div className="flex justify-between mb-1"><span>ICT Sources:</span> <span className="text-white">{stats.bySubject?.ict || 0}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-400" />
                Available Sources
              </h2>
              <button onClick={fetchData} className="text-sm text-gray-400 hover:text-white">Refresh</button>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading sources...</div>
            ) : sources.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No knowledge sources found.</p>
                <p className="text-sm mt-1">Upload a PDF to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {sources.map(src => (
                  <div key={src.id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-lg ${src.sourceType === 'note' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-200">{src.title}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span className="uppercase bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">{src.subject}</span>
                          <span className="capitalize">{src.sourceType.replace('_', ' ')}</span>
                          {src.year && <span>• {src.year}</span>}
                          <span>• {src.chunkCount} chunks</span>
                          {src.status === 'processing' && <span className="text-yellow-400">• Processing</span>}
                          {src.status === 'failed' && <span className="text-red-400">• Failed</span>}
                          {src.status === 'needs_ocr' && <span className="text-amber-500 font-semibold">• ⚠️ Needs OCR</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(src.status === 'needs_ocr' || src.chunkCount === 0) && (
                        <button
                          onClick={() => handleReindex(src.id)}
                          disabled={reindexingId !== null}
                          className="px-2.5 py-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20 transition-colors flex items-center gap-1.5"
                          title="Run OCR to extract text from images/scans inside PDF"
                        >
                          <Activity className="w-3 h-3" />
                          {reindexingId === src.id ? 'Reindexing...' : 'OCR Reindex'}
                        </button>
                      )}
                      {src.uploadedByUid === (user as any)?.uid && (
                        <button 
                          onClick={() => handleDelete(src.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
