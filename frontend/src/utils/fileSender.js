/**
 * File Sender
 *
 * Reads a file in 64KB chunks and sends over an RTCDataChannel.
 * Implements backpressure using bufferedAmount monitoring to avoid crashes.
 * Waits for a "ready" handshake from the receiver before sending chunks.
 */

const CHUNK_SIZE = 64 * 1024; // 64 KB
const BUFFER_THRESHOLD = 16 * 1024 * 1024; // 16 MB
const BUFFER_LOW_THRESHOLD = 1 * 1024 * 1024; // 1 MB

/**
 * Send a file over a WebRTC data channel with backpressure control.
 *
 * @param {RTCDataChannel} dataChannel
 * @param {File}           file
 * @param {function}       onProgress – callback({ bytesSent, totalBytes, percent })
 * @returns {Promise<void>}
 */
export function sendFile(dataChannel, file, onProgress) {
  return new Promise((resolve, reject) => {
    // Step 1: Send metadata
    const metadata = JSON.stringify({
      type: "metadata",
      filename: file.name,
      fileSize: file.size,
    });
    dataChannel.send(metadata);

    let offset = 0;
    const totalBytes = file.size;

    // Set threshold for the low-buffer event
    dataChannel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    function readAndSendChunk() {
      if (offset >= totalBytes) {
        onProgress?.({ bytesSent: totalBytes, totalBytes, percent: 100 });
        resolve();
        return;
      }

      // ── Backpressure guard ──────────────────────────────────────────
      if (dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
        // Pause: wait for the buffer to drain
        dataChannel.onbufferedamountlow = () => {
          dataChannel.onbufferedamountlow = null;
          readAndSendChunk();
        };
        return;
      }

      const end = Math.min(offset + CHUNK_SIZE, totalBytes);
      const slice = file.slice(offset, end);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          dataChannel.send(e.target.result);
          offset = end;

          const percent = Math.round((offset / totalBytes) * 100);
          onProgress?.({ bytesSent: offset, totalBytes, percent });

          // Use setTimeout to avoid stack overflow on many chunks
          // and to yield to the event loop
          setTimeout(readAndSendChunk, 0);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(slice);
    }

    // Step 2: Wait for "ready" handshake from the receiver
    // The receiver sends this after the user picks a save location
    const prevOnMessage = dataChannel.onmessage;
    dataChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            console.log("[Sender] Receiver ready, starting transfer…");
            // Restore previous handler (if any) and start sending
            dataChannel.onmessage = prevOnMessage;
            readAndSendChunk();
            return;
          }
        } catch (_) {}
      }
      // Forward non-ready messages to previous handler
      if (prevOnMessage) prevOnMessage(event);
    };
  });
}
