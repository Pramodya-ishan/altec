class PcmRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.offset++] = channelData[i];
      
      if (this.offset >= this.bufferSize) {
        // Convert to 16-bit PCM
        const pcmBuffer = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          let s = Math.max(-1, Math.min(1, this.buffer[j]));
          pcmBuffer[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send Int16Array to main thread
        this.port.postMessage(pcmBuffer);
        
        this.offset = 0;
      }
    }
    
    return true;
  }
}

registerProcessor("pcm-recorder-worklet", PcmRecorderWorklet);
