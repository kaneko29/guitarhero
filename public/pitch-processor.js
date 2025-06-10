class PitchProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._buffer = [];
      this._bufferSize = 44100;
      this._sampleRate = sampleRate;
  
      this.port.onmessage = (event) => {
        if (event.data === 'clear') {
          this._buffer = [];
        }
      };
    }
  
    process(inputs) {
      const input = inputs[0][0]; // mono channel
  
      if (!input) return true;
  
      this._buffer.push(...input);
  
      if (this._buffer.length >= this._bufferSize) {
        const buffer = this._buffer.slice(-this._bufferSize);
        this.port.postMessage(buffer);
        this._buffer = this._buffer.slice(-this._bufferSize); // keep last frame
      }
  
      return true;
    }
  }
  
  registerProcessor('pitch-processor', PitchProcessor);
  