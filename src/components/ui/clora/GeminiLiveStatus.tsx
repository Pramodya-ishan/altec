import React, { useEffect, useState } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

export function GeminiLiveStatus() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    reason?: string | null;
    loading: boolean;
  }>({
    enabled: false,
    reason: null,
    loading: true
  });

  useEffect(() => {
    fetch('/api/realtime/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setStatus({
          enabled: !!data.enabled,
          reason: data.reason,
          loading: false
        });
      })
      .catch(() => {
        setStatus({
          enabled: false,
          reason: 'network_error',
          loading: false
        });
      });
  }, []);

  if (status.loading) return null;

  if (status.enabled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[13px] font-medium border border-emerald-100 shadow-sm cursor-default">
        <Mic className="w-3.5 h-3.5" />
        Gemini Live Voice is available
      </div>
    );
  }

  if (status.reason === 'gemini_api_key_missing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[13px] font-medium border border-amber-100 shadow-sm cursor-help" title="Gemini is not configured on the server.">
        <AlertCircle className="w-3.5 h-3.5" />
        Gemini is not configured
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[13px] font-medium border border-slate-200 shadow-sm cursor-default">
      <MicOff className="w-3.5 h-3.5" />
      Gemini Live Voice is unavailable
    </div>
  );
}
