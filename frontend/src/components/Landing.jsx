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
          className="landing__logo"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="2" width="44" height="44" rx="12" stroke="#4f46e5" strokeWidth="2.5" fill="none" />
          <path
            d="M16 24h16M27 18l6 6-6 6"
            stroke="#4f46e5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="landing__title">TunnelTransfer</h1>
        <p className="landing__subtitle">
          Peer-to-peer file transfer. No uploads, no limits.
        </p>
      </div>

      <div className="landing__actions">
        {/* Create Room Card */}
        <div className="action-card">
          <div className="action-card__icon">🔒</div>
          <h2 className="action-card__title">Create Room</h2>
          <p className="action-card__desc">
            Generate a private room code and share it with your peer.
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
            Enter the room code shared by the creator to connect.
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
