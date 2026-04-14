/**
 * ProgressBar — Animated transfer progress display.
 */

export default function ProgressBar({
  percent = 0,
  bytesSent = 0,
  totalBytes = 0,
  filename = "",
}) {
  return (
    <div className="progress-container">
      <div className="file-info" style={{ marginBottom: "1.5rem", marginTop: 0 }}>
        <div className="file-info__icon">📄</div>
        <div className="file-info__details">
          <div className="file-info__name">{filename}</div>
          <div className="file-info__size">{formatBytes(totalBytes)}</div>
        </div>
      </div>

      <div className="progress-stats">
        <span className="progress-percent">{percent}%</span>
        <div className="progress-detail">
          <div>{formatBytes(bytesSent)} / {formatBytes(totalBytes)}</div>
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
