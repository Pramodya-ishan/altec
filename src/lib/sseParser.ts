export interface SSEEvent {
  event: string;
  data: string;
}

export class SSEParser {
  private buffer = '';

  public parse(chunk: string): SSEEvent[] {
    const events: SSEEvent[] = [];
    this.buffer += chunk;

    let blockEndIndex = -1;
    let blockLength = 0;

    // Process all complete blocks in the buffer
    while (true) {
      const rnIndex = this.buffer.indexOf('\r\n\r\n');
      const nnIndex = this.buffer.indexOf('\n\n');

      if (rnIndex !== -1 && (nnIndex === -1 || rnIndex < nnIndex)) {
        blockEndIndex = rnIndex;
        blockLength = 4;
      } else if (nnIndex !== -1) {
        blockEndIndex = nnIndex;
        blockLength = 2;
      } else {
        break; // Incomplete block, wait for more data
      }

      if (blockEndIndex === 0) {
        this.buffer = this.buffer.substring(blockLength);
        continue;
      }

      const block = this.buffer.substring(0, blockEndIndex);
      this.buffer = this.buffer.substring(blockEndIndex + blockLength);
      
      const parsedEvent = this.parseBlock(block);
      if (parsedEvent) {
         events.push(parsedEvent);
      }
    }

    return events;
  }

  private parseBlock(block: string): SSEEvent | null {
    const lines = block.split(/\r?\n/);
    let eventType = 'message';
    let dataBuffer: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue; // Ignore comments

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
         // Field name without value, treated as empty string
         if (line === 'data') dataBuffer.push('');
         continue;
      }

      const field = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1);
      
      // SSE spec says single leading space after colon should be ignored
      if (value.startsWith(' ')) {
        value = value.substring(1);
      }

      if (field === 'event') {
        eventType = value;
      } else if (field === 'data') {
        dataBuffer.push(value);
      }
    }

    if (dataBuffer.length === 0 && eventType === 'message') {
       return null; // Skip empty keep-alive pings unless it's a specific event type
    }

    return {
      event: eventType,
      data: dataBuffer.join('\n')
    };
  }
}
