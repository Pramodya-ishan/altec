import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { 
  FileText, 
  Search, 
  Database, 
  RefreshCw, 
  Eye, 
  Trash2, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Calendar,
  Book
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface Source {
  id: string;
  title: string;
  subject: string;
  year: string;
  resourceType: string;
  paperType: string;
  indexStatus: string;
  chunkCount: number;
  needsOcr: boolean;
  createdAt: string;
  updatedAt: string;
  storagePath: string;
}

export default function PdfSourcesPage() {
  const { user, showNotification } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSources = async () => {
    setLoading(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch('/api/pdf/sources', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setSources(data.sources);
      }
    } catch (err) {
      showNotification("Failed to fetch sources", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [user]);

  const handleAction = async (sourceId: string, action: string) => {
    setActionLoading(`${sourceId}_${action}`);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      let endpoint = '';
      let method = 'POST';

      if (action === 'reindex') {
        endpoint = `/api/rag/reindex-uploaded`;
      } else if (action === 'delete') {
        endpoint = `/api/rag/sources/${sourceId}`;
        method = 'DELETE';
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: method === 'POST' ? JSON.stringify({ sourceId, mode: action === 'reindex' ? 'auto' : 'ocr' }) : undefined
      });

      const data = await res.json();
      if (data.ok) {
        showNotification(`Action ${action} successful`, "success");
        fetchSources();
      } else {
        showNotification(data.error || "Action failed", "error");
      }
    } catch (err) {
      showNotification("Network error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSources = sources.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.year?.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">PDF Intelligence</h1>
          <p className="text-slate-500 font-medium mt-1">Manage official exam papers and indexed sources.</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search papers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-full md:w-80 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))
        ) : filteredSources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <FileText className="w-8 h-8" />
            </div>
            <p className="text-slate-500 font-medium">No PDF sources found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSources.map((source) => (
              <motion.div
                key={source.id}
                layout
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 border-l-4 border-l-indigo-500"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 leading-tight">{source.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        <Book className="w-3 h-3" /> {source.subject}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        <Calendar className="w-3 h-3" /> {source.year}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[12px] font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    <span>{source.chunkCount || 0} Chunks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", source.indexStatus === 'processing' && "animate-spin")} />
                    <span>{source.indexStatus}</span>
                  </div>
                </div>

                {source.needsOcr && (
                  <div className="bg-amber-50 border border-amber-100 text-amber-700 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" />
                    OCR Required
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                  <button 
                    onClick={() => navigate(`/question-cache?sourceId=${source.id}`)}
                    className="flex-1 min-w-[100px] h-9 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Cache
                  </button>
                  <button 
                    onClick={() => handleAction(source.id, 'reindex')}
                    disabled={!!actionLoading}
                    className="flex-1 min-w-[100px] h-9 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {actionLoading === `${source.id}_reindex` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Reindex
                  </button>
                  <button 
                    onClick={() => handleAction(source.id, 'delete')}
                    className="h-9 w-9 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
