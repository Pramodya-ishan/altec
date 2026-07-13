export class RealtimeVoiceClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  async connect({ clientSecret, chatId, activeSubject, activeSourceId }: any) {
    try {
      this.pc = new RTCPeerConnection();
      
      this.audioEl = document.createElement("audio");
      this.audioEl.autoplay = true;
      this.pc.ontrack = (e) => {
        if (this.audioEl) {
          this.audioEl.srcObject = e.streams[0];
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pc.addTrack(this.mediaStream.getTracks()[0], this.mediaStream);

      this.dc = this.pc.createDataChannel("oai-events");
      this.dc.onopen = () => this.emit("open");
      this.dc.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        this.emit("event", msg);
        if (msg.type === "response.audio_transcript.delta") {
          this.emit("transcript_delta", { role: "assistant", text: msg.delta });
        } else if (msg.type === "conversation.item.input_audio_transcription.completed") {
          this.emit("transcript_final", { role: "user", text: msg.transcript });
        } else if (msg.type === "response.done") {
          this.emit("response_done", msg);
        } else if (msg.type === "response.function_call_arguments.done") {
          this.emit("tool_call", { callId: msg.call_id, name: msg.name, arguments: msg.arguments });
        } else if (msg.type === "input_audio_buffer.speech_started") {
          this.emit("speech_started");
        } else if (msg.type === "input_audio_buffer.speech_stopped") {
          this.emit("speech_stopped");
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
         throw new Error(`SDP response error: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer = { type: "answer" as RTCSdpType, sdp: answerSdp };
      await this.pc.setRemoteDescription(answer);
      
      this.emit("connected");
    } catch (err) {
      this.emit("error", err);
      this.disconnect();
      throw err;
    }
  }

  sendToolResult(callId: string, result: any) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(result)
        }
      }));
      this.dc.send(JSON.stringify({ type: "response.create" }));
    }
  }
  
  sendMessage(text: string) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text }
          ]
        }
      }));
      this.dc.send(JSON.stringify({ type: "response.create" }));
    }
  }

  interrupt() {
    if (this.dc && this.dc.readyState === "open") {
       this.dc.send(JSON.stringify({ type: "response.cancel" }));
    }
  }

  mute() {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(t => t.enabled = false);
    }
  }

  unmute() {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(t => t.enabled = true);
    }
  }

  disconnect() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.dc = null;
    this.emit("disconnected");
    this.eventListeners.clear();
  }
}
