import { useState, useRef, useCallback } from "react";
import ProgressBar from "./ProgressBar";

/**
 * TransferRoom — File drop zone, progress display, and completion UI.
 */
export default function TransferRoom({
  roomId,
  status,      // "waiting" | "connected" | "incoming" | "transferring" | "complete" | "error"
  role,        // "sender" | "receiver" | null
  progress,    // { percent, bytesSent/bytesReceived, totalBytes, filename }
  onFileSelect,
  onSendFile,
  selectedFile,
  onLeave,
  errorMessage,
  incomingFile,  // { filename, fileSize } — when a file is offered
  onAcceptFile,  // called from user click → triggers showSaveFilePicker
  onTransferAnother, // reset to connected state for another transfer
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [roomId]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
  };

  const statusLabels = {
    waiting: "Waiting for peer to join…",
    connected: "Peer connected! Ready to transfer.",
    incoming: "Incoming file!",
    transferring: role === "sender" ? "Sending file…" : "Receiving file…",
    complete: "Transfer complete!",
    error: errorMessage || "Connection error.",
  };

  const statusDotClass = `status-dot status-dot--${status}`;

  return (
    <div className="transfer-room">
      {/* Back Button */}
      <div className="transfer-room__back">
        <button className="btn btn--secondary" onClick={onLeave} id="btn-leave-room">
          ← Leave
        </button>
      </div>

      {/* Header */}
      <div className="transfer-room__header">
        {/* Room Code */}
        <div className="room-code" onClick={handleCopyCode} title="Click to copy" id="room-code-display">
          <div>
            <div className="room-code__label">Room Code</div>
            <div className="room-code__value">{roomId}</div>
          </div>
          <span className="room-code__copy">{copied ? "✓" : "📋"}</span>
        </div>

        {/* Status */}
        <div className="status-indicator">
          <span className={statusDotClass} />
          <span>{statusLabels[status]}</span>
        </div>
      </div>

      {/* ── Waiting State ────────────────────────────────────────────── */}
      {status === "waiting" && (
        <div className="waiting-card">
          <div className="waiting-card__spinner" />
          <div className="waiting-card__text">
            Share the room code with your peer
          </div>
          <div className="waiting-card__subtext">
            They can paste it in the "Join Room" field to connect
          </div>
        </div>
      )}

      {/* ── Connected: Show drop zone for sender ─────────────────────── */}
      {status === "connected" && (
        <>
          <div
            className={`drop-zone ${isDragOver ? "drop-zone--active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            id="drop-zone"
          >
            <div className="drop-zone__icon">📁</div>
            <div className="drop-zone__text">
              Drag & drop a file here, or <strong>browse</strong>
            </div>
            <div className="drop-zone__hint">
              File is sent directly to your peer — never uploaded to a server
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileInput}
              id="file-input"
            />
          </div>

          {selectedFile && (
            <>
              <div className="file-info">
                <div className="file-info__icon">📄</div>
                <div className="file-info__details">
                  <div className="file-info__name">{selectedFile.name}</div>
                  <div className="file-info__size">
                    {formatBytes(selectedFile.size)}
                  </div>
                </div>
                <button
                  className="btn btn--success"
                  onClick={() => onSendFile(selectedFile)}
                  id="btn-send-file"
                >
                  Send File 🚀
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Incoming File: Accept prompt ──────────────────────────────── */}
      {status === "incoming" && incomingFile && (
        <div className="complete-card" style={{ borderColor: "rgba(108,99,255,0.3)" }}>
          <div className="complete-card__check" style={{ background: "var(--gradient-button)" }}>
            📥
          </div>
          <h2 className="complete-card__title">Incoming File</h2>
          <p className="complete-card__detail">
            {incomingFile.filename} — {formatBytes(incomingFile.fileSize)}
          </p>
          <button
            className="btn btn--success"
            onClick={onAcceptFile}
            id="btn-accept-file"
          >
            Accept & Save 💾
          </button>
        </div>
      )}

      {/* ── Transferring ─────────────────────────────────────────────── */}
      {status === "transferring" && progress && (
        <ProgressBar
          percent={progress.percent}
          bytesSent={progress.bytesSent || progress.bytesReceived || 0}
          totalBytes={progress.totalBytes}
          filename={progress.filename}
        />
      )}

      {/* ── Complete ─────────────────────────────────────────────────── */}
      {status === "complete" && (
        <div className="complete-card">
          <div className="complete-card__check">✓</div>
          <h2 className="complete-card__title">Transfer Complete!</h2>
          <p className="complete-card__detail">
            {progress?.filename} — {formatBytes(progress?.totalBytes || 0)}
          </p>
          <button className="btn btn--primary" onClick={onTransferAnother} id="btn-done">
            Transfer Another File
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="complete-card" style={{ borderColor: "rgba(255,77,106,0.3)" }}>
          <div className="complete-card__check" style={{ background: "linear-gradient(135deg, #ff4d6a, #ff6b81)" }}>
            ✕
          </div>
          <h2 className="complete-card__title">Connection Lost</h2>
          <p className="complete-card__detail">{errorMessage}</p>
          <button className="btn btn--primary" onClick={onLeave} id="btn-retry">
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
