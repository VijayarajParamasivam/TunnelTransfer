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

  dataChannel.onmessage = async (event) => {
    try {
      // ── Metadata message (JSON string) ──────────────────────────────
      if (typeof event.data === "string") {
        const meta = JSON.parse(event.data);
        if (meta.type === "metadata") {
          filename = meta.filename;
          totalBytes = meta.fileSize;
          bytesReceived = 0;

          // Notify the app — UI will show an "Accept" button
          onIncomingFile?.({ filename, fileSize: totalBytes });
        }
        return;
      }

      // ── Binary chunk (ArrayBuffer) ──────────────────────────────────
      if (event.data instanceof ArrayBuffer && writableStream && streamReady) {
        await writableStream.write(event.data);
        bytesReceived += event.data.byteLength;

        const percent = Math.round((bytesReceived / totalBytes) * 100);
        onProgress?.({ bytesReceived, totalBytes, percent, filename });

        // Transfer complete
        if (bytesReceived >= totalBytes) {
          await writableStream.close();
          writableStream = null;
          streamReady = false;
          onComplete?.({ filename, fileSize: totalBytes });
        }
      }
    } catch (err) {
      console.error("[Receiver] Error:", err);
      if (writableStream) {
        try { await writableStream.abort(); } catch (_) {}
        writableStream = null;
        streamReady = false;
      }
      onError?.(err);
    }
  };

  /**
   * Must be called from a user gesture (click handler).
   * Opens the save file picker and signals the sender to begin.
   */
  async function acceptFile() {
    try {
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
