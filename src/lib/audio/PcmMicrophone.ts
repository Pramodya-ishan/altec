export class PcmMicrophone {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onAudioData: ((base64Pcm: string) => void) | null = null;

  async start(onAudioData: (base64Pcm: string) => void) {
    this.onAudioData = onAudioData;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    
    await this.audioContext.audioWorklet.addModule("/worklets/pcm-recorder.worklet.js");
    
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-recorder-worklet");
    
    this.workletNode.port.onmessage = (event) => {
      if (this.onAudioData) {
        const pcmBuffer = event.data as Int16Array;
        const base64 = this.arrayBufferToBase64(pcmBuffer.buffer);
        this.onAudioData(base64);
      }
    };
    
    this.source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.onAudioData = null;
  }
  
  mute() {
      if (this.stream) {
          this.stream.getAudioTracks().forEach(t => t.enabled = false);
      }
  }
  
  unmute() {
      if (this.stream) {
          this.stream.getAudioTracks().forEach(t => t.enabled = true);
      }
  }
}
