/**
 * File Sender
 *
 * Reads a file in 64KB chunks and sends over an RTCDataChannel.
 * Implements backpressure using bufferedAmount monitoring to avoid crashes.
 * Waits for a "ready" handshake from the receiver before sending chunks.
 */

const CHUNK_SIZE = 64 * 1024; // 64 KB
const BUFFER_HIGH = 2 * 1024 * 1024; // 2 MB — pause when buffer exceeds this
const BUFFER_LOW = 512 * 1024; // 512 KB — resume when buffer drops below this

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
    console.log("[Sender] Metadata sent:", file.name, file.size, "bytes. Waiting for receiver…");

    let offset = 0;
    const totalBytes = file.size;

    // Set the low-water mark for the bufferedamountlow event
    dataChannel.bufferedAmountLowThreshold = BUFFER_LOW;

    function sendNextChunk() {
      while (offset < totalBytes) {
        // ── Backpressure: pause if buffer is getting full ──────────────
        if (dataChannel.bufferedAmount > BUFFER_HIGH) {
          // Wait for buffer to drain before sending more
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            sendNextChunk();
          };
          return; // Exit the loop, will resume from onbufferedamountlow
        }

        const end = Math.min(offset + CHUNK_SIZE, totalBytes);
        const slice = file.slice(offset, end);

        // Read the slice synchronously-ish using a FileReaderSync workaround:
        // Actually, use the blob.arrayBuffer() API which returns a promise
        // But we need to stay in a sync loop for backpressure to work.
        // Use slice + FileReader for each chunk.
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            dataChannel.send(e.target.result);
            offset = end;

            const percent = Math.round((offset / totalBytes) * 100);
            onProgress?.({ bytesSent: offset, totalBytes, percent });

            if (offset >= totalBytes) {
              resolve();
              return;
            }

            // Continue sending — use setTimeout to yield to event loop
            // This gives the buffer time to drain and events to process
            setTimeout(sendNextChunk, 0);
          } catch (err) {
            // If send fails (queue full), wait and retry
            if (err.message && err.message.includes("send queue is full")) {
              console.warn("[Sender] Queue full, pausing…");
              offset = end - (end - (offset)); // don't advance offset
              dataChannel.onbufferedamountlow = () => {
                dataChannel.onbufferedamountlow = null;
                sendNextChunk();
              };
            } else {
              cleanupListener();
              reject(err);
            }
          }
        };
        reader.onerror = () => { cleanupListener(); reject(reader.error); };
        reader.readAsArrayBuffer(slice);
        return; // FileReader is async, so exit loop — onload will continue
      }
    }

    // Step 2: Listen for "ready" handshake from receiver
    function onReadyMessage(event) {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            console.log("[Sender] Receiver ready, starting transfer…");
            cleanupListener();
            sendNextChunk();
          }
        } catch (_) {}
      }
    }

    function cleanupListener() {
      dataChannel.removeEventListener("message", onReadyMessage);
    }

    dataChannel.addEventListener("message", onReadyMessage);
  });
}
