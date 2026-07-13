import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

export type GeminiLiveState =
  | "idle"
  | "connecting"
  | "connected"
  | "closed"
  | "error";

export interface GeminiLiveCallbacks {
  onOpen?: () => void;
  onClose?: (reason?: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: LiveServerMessage) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onAudioChunk?: (base64Audio: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onToolCall?: (toolCall: unknown) => void;
}

interface ConnectOptions {
  token: string;
  model: string;
  systemInstruction: string;
  callbacks?: GeminiLiveCallbacks;
}

export class GeminiLiveClient {
  private session: Session | null = null;
  private state: GeminiLiveState = "idle";

  getState(): GeminiLiveState {
    return this.state;
  }

  async connect({
    token,
    model,
    systemInstruction,
    callbacks,
  }: ConnectOptions): Promise<void> {
    if (this.session) {
      this.disconnect();
    }

    this.state = "connecting";

    try {
      const ai = new GoogleGenAI({
        apiKey: token,

        httpOptions: {
          apiVersion: "v1alpha",
        },
      });

      this.session = await ai.live.connect({
        model,

        config: {
          responseModalities: [Modality.AUDIO],

          systemInstruction: {
            parts: [
              {
                text: systemInstruction,
              },
            ],
          },

          inputAudioTranscription: {},
          outputAudioTranscription: {},

          sessionResumption: {},
        },

        callbacks: {
          onopen: () => {
            this.state = "connected";
            callbacks?.onOpen?.();
          },

          onmessage: (message: LiveServerMessage) => {
            callbacks?.onMessage?.(message);

            const serverContent = message.serverContent;

            if (serverContent?.inputTranscription?.text) {
              callbacks?.onInputTranscript?.(
                serverContent.inputTranscription.text,
              );
            }

            if (serverContent?.outputTranscription?.text) {
              callbacks?.onOutputTranscript?.(
                serverContent.outputTranscription.text,
              );
            }

            const parts =
              serverContent?.modelTurn?.parts ?? [];

            for (const part of parts) {
              const inlineData = part.inlineData;

              if (
                inlineData?.data &&
                inlineData.mimeType?.startsWith("audio/")
              ) {
                callbacks?.onAudioChunk?.(
                  inlineData.data,
                );
              }
            }

            if (serverContent?.interrupted) {
              callbacks?.onInterrupted?.();
            }

            if (serverContent?.turnComplete) {
              callbacks?.onTurnComplete?.();
            }

            if (message.toolCall) {
              callbacks?.onToolCall?.(
                message.toolCall,
              );
            }
          },

          onerror: (event: any) => {
            this.state = "error";

            callbacks?.onError?.(
              new Error(
                event?.message ||
                  "Gemini Live connection failed.",
              ),
            );
          },

          onclose: (event: any) => {
            this.state = "closed";
            this.session = null;

            callbacks?.onClose?.(
              event?.reason,
            );
          },
        } as any, // Cast to any to avoid strict type issues across GenAI versions
      });
    } catch (error) {
      this.state = "error";
      this.session = null;

      const normalizedError =
        error instanceof Error
          ? error
          : new Error(String(error));

      callbacks?.onError?.(
        normalizedError,
      );

      throw normalizedError;
    }
  }

  sendText(text: string): void {
    const trimmed = text.trim();

    if (!trimmed || !this.session) {
      return;
    }

    this.session.sendRealtimeInput([{
      text: trimmed,
    }] as any);
  }

  sendAudioChunk(
    base64PcmAudio: string,
    sampleRate = 16_000,
  ): void {
    if (!this.session || !base64PcmAudio) {
      return;
    }

    this.session.sendRealtimeInput([{
      mimeType: `audio/pcm;rate=${sampleRate}`,
      data: base64PcmAudio,
    }] as any);
  }

  sendToolResponse(
    functionResponses: unknown[],
  ): void {
    if (!this.session) {
      return;
    }

    this.session.sendToolResponse(functionResponses as any);
  }

  disconnect(): void {
    try {
      (this.session as any)?.close?.();
    } catch (e) {
      // Ignore
    } finally {
      this.session = null;
      this.state = "closed";
    }
  }
}
