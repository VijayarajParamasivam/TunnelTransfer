/**
 * File Receiver
 *
 * Uses the File System Access API (showSaveFilePicker) to stream
 * incoming WebRTC chunks directly to disk — no Blobs in RAM.
 *
 * Two-phase flow:
 *   1. Metadata arrives → store it, notify the app (onIncomingFile)
 *   2. User clicks Accept → app calls acceptFile() which triggers
 *      showSaveFilePicker (user gesture) and sends "ready" to sender
 */

/**
 * Setup file receiving on a data channel.
 *
 * @param {RTCDataChannel} dataChannel
 * @param {function}       onIncomingFile – ({ filename, fileSize }) called when metadata arrives
 * @param {function}       onProgress     – ({ bytesReceived, totalBytes, percent, filename })
 * @param {function}       onComplete     – ({ filename, fileSize })
 * @param {function}       onError        – (error)
 * @returns {{ acceptFile: () => Promise<void> }}
 */
export function setupReceiver(dataChannel, onIncomingFile, onProgress, onComplete, onError) {
  let writableStream = null;
  let bytesReceived = 0;
  let totalBytes = 0;
  let filename = "";
  let streamReady = false;

  function handleMessage(event) {
    try {
      // ── Metadata message (JSON string) ──────────────────────────────
      if (typeof event.data === "string") {
        let parsed;
        try { parsed = JSON.parse(event.data); } catch { return; }

        if (parsed.type === "metadata") {
          filename = parsed.filename;
          totalBytes = parsed.fileSize;
          bytesReceived = 0;
          streamReady = false;

          console.log("[Receiver] Got metadata:", filename, totalBytes, "bytes");
          // Notify the app — UI will show an "Accept" button
          onIncomingFile?.({ filename, fileSize: totalBytes });
        }
        // Ignore other string messages (e.g. "ready" from sender side)
        return;
      }

      // ── Binary chunk (ArrayBuffer) ──────────────────────────────────
      if (event.data instanceof ArrayBuffer && writableStream && streamReady) {
        writableStream.write(event.data).then(() => {
          bytesReceived += event.data.byteLength;

          const percent = Math.round((bytesReceived / totalBytes) * 100);
          onProgress?.({ bytesReceived, totalBytes, percent, filename });

          // Transfer complete
          if (bytesReceived >= totalBytes) {
            writableStream.close().then(() => {
              writableStream = null;
              streamReady = false;
              onComplete?.({ filename, fileSize: totalBytes });
            });
          }
        }).catch((err) => {
          console.error("[Receiver] Write error:", err);
          onError?.(err);
        });
      }
    } catch (err) {
      console.error("[Receiver] Error:", err);
      if (writableStream) {
        try { writableStream.abort(); } catch (_) {}
        writableStream = null;
        streamReady = false;
      }
      onError?.(err);
    }
  }

  // Use addEventListener so it doesn't conflict with other handlers
  dataChannel.addEventListener("message", handleMessage);
  console.log("[Receiver] Setup complete, listening for metadata");

  /**
   * Must be called from a user gesture (click handler).
   * Opens the save file picker and signals the sender to begin.
   */
  async function acceptFile() {
    try {
      console.log("[Receiver] User clicked Accept, opening file picker...");
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
      });
      writableStream = await fileHandle.createWritable();
      streamReady = true;

      onProgress?.({ bytesReceived: 0, totalBytes, percent: 0, filename });

      // Tell the sender we're ready to receive chunks
      dataChannel.send(JSON.stringify({ type: "ready" }));
      console.log("[Receiver] Save location picked, sent ready signal");
    } catch (err) {
      console.error("[Receiver] Accept error:", err);
      onError?.(err);
    }
  }

  return { acceptFile };
}
