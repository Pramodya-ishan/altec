import { useState, useRef, useCallback } from 'react';
import { SSEParser, SSEEvent } from '../lib/sseParser';
import { apiFetch } from '../lib/api';

export type AIProcessingPhase =
  | "idle"
  | "validating_request"
  | "authenticating_user"
  | "sanitizing_data"
  | "building_academic_snapshot"
  | "organizing_sft"
  | "organizing_et"
  | "organizing_ict"
  | "checking_zscore_history"
  | "checking_data_quality"
  | "generating_requirements"
  | "waiting_for_answers"
  | "running_analysis_model"
  | "ranking_lessons"
  | "building_daily_schedule"
  | "building_exam_countdown"
  | "building_past_paper_plan"
  | "checking_workload"
  | "validating_analysis"
  | "repairing_structured_output"
  | "running_final_writer"
  | "complete"
  | "cancelled"
  | "error";

export interface AIStreamState {
  isStreaming: boolean;
  phase: AIProcessingPhase;
  phaseMessage: string;
  text: string;
  error?: string;
  thinkingSummary?: string;
}

export function useAIStream() {
  const [state, setState] = useState<AIStreamState>({
    isStreaming: false,
    phase: 'idle',
    phaseMessage: '',
    text: '',
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (
    url: string, 
    body: any, 
    onEvent?: (event: SSEEvent) => void
  ) => {
    setState({
      isStreaming: true,
      phase: 'validating_request',
      phaseMessage: 'Starting...',
      text: '',
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to start stream: ${response.status}`);
      }
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SSEParser();

      let accumText = '';

      let lastRafTime = 0;
      let textBuf = '';
      
      const flushText = () => {
         if (textBuf) {
            accumText += textBuf;
            setState(prev => ({ ...prev, text: accumText }));
            textBuf = '';
         }
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const events = parser.parse(chunk);
          
          for (const event of events) {
            if (onEvent) onEvent(event);

            if (event.event === 'status') {
              try {
                const data = JSON.parse(event.data);
                setState(prev => ({ 
                  ...prev, 
                  phase: data.phase, 
                  phaseMessage: data.message 
                }));
              } catch (e) {}
            } else if (event.event === 'final_chunk') {
              try {
                const data = JSON.parse(event.data);
                if (data.text) {
                  textBuf += data.text;
                  const now = performance.now();
                  if (now - lastRafTime > 60) {
                     flushText();
                     lastRafTime = now;
                  }
                }
              } catch (e) {}
            } else if (event.event === 'error') {
               try {
                  const data = JSON.parse(event.data);
                  setState(prev => ({ ...prev, error: data.message || 'Stream error', phase: 'error', isStreaming: false }));
               } catch (e) {}
            } else if (event.event === 'done') {
                flushText();
                setState(prev => ({ ...prev, isStreaming: false, phase: 'complete' }));
                return;
            }
          }
        }
        
        if (done) break;
      }

      flushText();
      
      setState(prev => ({ 
        ...prev, 
        isStreaming: false, 
        phase: prev.error ? 'error' : prev.phase === 'cancelled' ? 'cancelled' : 'complete' 
      }));

    } catch (e: any) {
      if (e.name === 'AbortError' || abortController.signal.aborted) {
        setState(prev => ({ ...prev, isStreaming: false, phase: 'cancelled' }));
      } else {
        setState(prev => ({ 
          ...prev, 
          isStreaming: false, 
          phase: 'error', 
          error: e.message 
        }));
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { state, startStream, cancelStream, setState };
}
