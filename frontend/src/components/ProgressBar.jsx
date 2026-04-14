/**
 * ProgressBar — Clean transfer progress display.
 */
export default function ProgressBar({
  percent = 0,
  bytesSent = 0,
  totalBytes = 0,
  filename = "",
}) {
  return (
    <div className="progress-container">
      <div className="file-info" style={{ marginBottom: "1.25rem", marginTop: 0, border: "none", padding: 0, boxShadow: "none" }}>
        <div className="file-info__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="file-info__details">
          <div className="file-info__name">{filename}</div>
          <div className="file-info__size">{formatBytes(totalBytes)}</div>
        </div>
      </div>

      <div className="progress-stats">
        <span className="progress-percent">{percent}%</span>
        <div className="progress-detail">
          {formatBytes(bytesSent)} / {formatBytes(totalBytes)}
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
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
