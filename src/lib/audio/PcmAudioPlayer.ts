export class PcmAudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;

  constructor(public sampleRate = 24000) {}

  init() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  enqueue(base64Audio: string) {
    if (!this.audioContext) this.init();
    if (!this.audioContext) return;

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    if (this.nextStartTime < this.audioContext.currentTime) {
      this.nextStartTime = this.audioContext.currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.nextStartTime = 0;
    }
  }
}
