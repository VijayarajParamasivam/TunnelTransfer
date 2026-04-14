import { useState, useRef, useCallback } from "react";
import ProgressBar from "./ProgressBar";

/**
 * TransferRoom — File drop zone, progress display, and completion UI.
 */
export default function TransferRoom({
  roomId,
  status,
  role,
  progress,
  onFileSelect,
  onSendFile,
  selectedFile,
  onLeave,
  errorMessage,
  incomingFile,
  onAcceptFile,
  onTransferAnother,
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
    connected: "Ready to transfer",
    incoming: "Incoming file",
    transferring: role === "sender" ? "Sending…" : "Receiving…",
    complete: "Transfer complete",
    error: errorMessage || "Connection error",
  };

  return (
    <div className="transfer-room">
      {/* Back */}
      <div className="transfer-room__back">
        <button className="btn btn--secondary" onClick={onLeave} id="btn-leave-room">
          ← Leave Room
        </button>
      </div>

      {/* Header */}
      <div className="transfer-room__header">
        <div className="room-code" onClick={handleCopyCode} title="Click to copy" id="room-code-display">
          <div>
            <div className="room-code__label">Room Code</div>
            <div className="room-code__value">{roomId}</div>
          </div>
          <span className="room-code__copy">{copied ? "✓" : "⎘"}</span>
        </div>
        <div className="status-indicator">
          <span className={`status-dot status-dot--${status}`} />
          <span>{statusLabels[status]}</span>
        </div>
      </div>

      {/* ── Waiting ──────────────────────────────────────────────────────── */}
      {status === "waiting" && (
        <div className="waiting-card">
          <div className="waiting-card__spinner" />
          <div className="waiting-card__text">
            Share the room code with your peer
          </div>
          <div className="waiting-card__subtext">
            They'll enter it in the "Join Room" field to connect
          </div>
        </div>
      )}

      {/* ── Connected: Drop zone ─────────────────────────────────────────── */}
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
            <div className="drop-zone__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="drop-zone__text">
              Drop a file here, or <strong>browse</strong>
            </div>
            <div className="drop-zone__hint">
              Sent directly to your peer — never uploaded to a server
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
            <div className="file-info">
              <div className="file-info__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="file-info__details">
                <div className="file-info__name">{selectedFile.name}</div>
                <div className="file-info__size">{formatBytes(selectedFile.size)}</div>
              </div>
              <button
                className="btn btn--primary"
                onClick={() => onSendFile(selectedFile)}
                id="btn-send-file"
              >
                Send
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Incoming File ────────────────────────────────────────────────── */}
      {status === "incoming" && incomingFile && (
        <div className="result-card">
          <div className="result-card__icon result-card__icon--incoming">↓</div>
          <h2 className="result-card__title">Incoming File</h2>
          <p className="result-card__detail">
            {incomingFile.filename} — {formatBytes(incomingFile.fileSize)}
          </p>
          <button
            className="btn btn--success"
            onClick={onAcceptFile}
            id="btn-accept-file"
          >
            Accept & Save
          </button>
        </div>
      )}

      {/* ── Transferring ─────────────────────────────────────────────────── */}
      {status === "transferring" && progress && (
        <ProgressBar
          percent={progress.percent}
          bytesSent={progress.bytesSent || progress.bytesReceived || 0}
          totalBytes={progress.totalBytes}
          filename={progress.filename}
        />
      )}

      {/* ── Complete ─────────────────────────────────────────────────────── */}
      {status === "complete" && (
        <div className="result-card">
          <div className="result-card__icon result-card__icon--success">✓</div>
          <h2 className="result-card__title">Transfer Complete</h2>
          <p className="result-card__detail">
            {progress?.filename} — {formatBytes(progress?.totalBytes || 0)}
          </p>
          <button className="btn btn--primary" onClick={onTransferAnother} id="btn-done">
            Transfer Another File
          </button>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="result-card">
          <div className="result-card__icon result-card__icon--error">✕</div>
          <h2 className="result-card__title">Connection Lost</h2>
          <p className="result-card__detail">{errorMessage}</p>
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
