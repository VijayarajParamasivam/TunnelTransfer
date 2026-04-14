/**
 * File Sender — High Performance
 *
 * Reads a file in 256KB chunks and sends over an RTCDataChannel.
 * Uses a tight send loop with backpressure to maximize throughput.
 * Waits for a "ready" handshake from the receiver before sending.
 */

const CHUNK_SIZE = 256 * 1024; // 256 KB — larger chunks = fewer round-trips
const BUFFER_HIGH = 8 * 1024 * 1024; // 8 MB — pause threshold
const BUFFER_LOW = 2 * 1024 * 1024; // 2 MB — resume threshold

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

    dataChannel.bufferedAmountLowThreshold = BUFFER_LOW;

    async function pumpChunks() {
      try {
        while (offset < totalBytes) {
          // ── Backpressure: pause if buffer is filling up ──────────────
          if (dataChannel.bufferedAmount > BUFFER_HIGH) {
            await waitForDrain();
            continue;
          }

          const end = Math.min(offset + CHUNK_SIZE, totalBytes);
          const slice = file.slice(offset, end);
          const buffer = await slice.arrayBuffer();

          try {
            dataChannel.send(buffer);
          } catch (err) {
            if (err.message?.includes("send queue is full")) {
              console.warn("[Sender] Queue full, waiting for drain…");
              await waitForDrain();
              dataChannel.send(buffer); // retry once after drain
            } else {
              throw err;
            }
          }

          offset = end;

          // Report progress every ~1MB to avoid UI thrashing
          if (offset % (1024 * 1024) < CHUNK_SIZE || offset >= totalBytes) {
            const percent = Math.round((offset / totalBytes) * 100);
            onProgress?.({ bytesSent: offset, totalBytes, percent });
          }
        }

        onProgress?.({ bytesSent: totalBytes, totalBytes, percent: 100 });
        resolve();
      } catch (err) {
        cleanupListener();
        reject(err);
      }
    }

    function waitForDrain() {
      return new Promise((res) => {
        // First try: bufferedamountlow event
        const timeout = setTimeout(() => {
          // Fallback: if event doesn't fire in 2s, check manually
          dataChannel.onbufferedamountlow = null;
          if (dataChannel.bufferedAmount <= BUFFER_LOW) {
            res();
          } else {
            // Poll every 100ms as last resort
            const poll = setInterval(() => {
              if (dataChannel.bufferedAmount <= BUFFER_LOW) {
                clearInterval(poll);
                res();
              }
            }, 100);
          }
        }, 2000);

        dataChannel.onbufferedamountlow = () => {
          clearTimeout(timeout);
          dataChannel.onbufferedamountlow = null;
          res();
        };
      });
    }

    // Step 2: Listen for "ready" handshake from receiver
    function onReadyMessage(event) {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            console.log("[Sender] Receiver ready, starting transfer…");
            cleanupListener();
            pumpChunks();
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
