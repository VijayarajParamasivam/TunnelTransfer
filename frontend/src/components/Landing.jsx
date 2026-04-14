import { useState, useRef } from "react";

/**
 * Landing — Create or Join a transfer room.
 */
export default function Landing({ onCreateRoom, onJoinRoom, isConnecting }) {
  const [joinCode, setJoinCode] = useState("");
  const inputRef = useRef(null);

  const handleJoin = () => {
    const code = joinCode.trim().toLowerCase();
    if (code.length > 0) {
      onJoinRoom(code);
    } else {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="landing">
      <div className="landing__brand">
        <svg
          className="landing__icon"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="iconGrad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stopColor="#6c63ff" />
              <stop offset="100%" stopColor="#00d4aa" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="56" height="56" rx="16" stroke="url(#iconGrad)" strokeWidth="3" fill="none" />
          <path
            d="M22 32h20M36 24l8 8-8 8"
            stroke="url(#iconGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="32" r="3" fill="#6c63ff" />
          <circle cx="48" cy="32" r="3" fill="#00d4aa" />
        </svg>
        <h1 className="landing__title">TunnelTransfer</h1>
        <p className="landing__subtitle">
          Peer-to-peer file transfer. No servers, no limits, no traces.
        </p>
      </div>

      <div className="landing__actions">
        {/* Create Room Card */}
        <div className="action-card">
          <div className="action-card__icon">🚀</div>
          <h2 className="action-card__title">Create Room</h2>
          <p className="action-card__desc">
            Generate a private room code and share&nbsp;it with your peer to begin.
          </p>
          <button
            id="btn-create-room"
            className={`btn btn--primary ${isConnecting ? "btn--disabled" : ""}`}
            onClick={onCreateRoom}
            disabled={isConnecting}
          >
            {isConnecting ? "Creating…" : "Create Room"}
          </button>
        </div>

        {/* Join Room Card */}
        <div className="action-card">
          <div className="action-card__icon">🔗</div>
          <h2 className="action-card__title">Join Room</h2>
          <p className="action-card__desc">
            Enter the 6-character code shared by the room creator to connect.
          </p>
          <input
            id="input-room-code"
            ref={inputRef}
            className="input"
            type="text"
            placeholder="Enter room code"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isConnecting}
          />
          <div style={{ height: "0.75rem" }} />
          <button
            id="btn-join-room"
            className={`btn btn--primary ${
              !joinCode.trim() || isConnecting ? "btn--disabled" : ""
            }`}
            onClick={handleJoin}
            disabled={!joinCode.trim() || isConnecting}
          >
            {isConnecting ? "Joining…" : "Join Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
