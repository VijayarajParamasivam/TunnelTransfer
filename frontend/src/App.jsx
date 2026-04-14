import { useState, useRef, useCallback, useEffect } from "react";
import Landing from "./components/Landing";
import TransferRoom from "./components/TransferRoom";
import { createWebSocket } from "./utils/websocket";
import { createPeerConnection } from "./utils/webrtc";
import { sendFile } from "./utils/fileSender";
import { setupReceiver } from "./utils/fileReceiver";
import "./App.css";

/**
 * App — Root orchestrator.
 *
 * State machine: idle → waiting → connected → incoming → transferring → complete
 */
export default function App() {
  // ── State ───────────────────────────────────────────────────────────
  const [view, setView] = useState("landing"); // "landing" | "room"
  const [status, setStatus] = useState("idle"); // idle | waiting | connected | incoming | transferring | complete | error
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState(null); // "sender" | "receiver" | null
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null); // { filename, fileSize }

  // Refs for cleanup
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const dcRef = useRef(null);
  const clientIdRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const receiverRef = useRef(null); // { acceptFile }

  // ── Generate unique client ID ───────────────────────────────────────
  const genClientId = () =>
    "client_" + Math.random().toString(36).substring(2, 10);

  // ── Toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Cleanup everything ──────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.cleanup();
      peerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dcRef.current = null;
    isInitiatorRef.current = false;
    receiverRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  // ── Setup WebRTC when peer connects ─────────────────────────────────
  const setupWebRTC = useCallback(
    (ws, isInitiator) => {
      isInitiatorRef.current = isInitiator;

      const { pc, cleanup } = createPeerConnection(
        ws,
        isInitiator,
        // onDataChannel ready
        (dataChannel) => {
          dcRef.current = dataChannel;
          setStatus("connected");
          showToast("success", "Peer connected! Data channel ready.");

          // Set up file receiver for BOTH sides so either can send/receive
          const receiver = setupReceiver(
            dataChannel,
            // onIncomingFile — metadata arrived, show accept prompt
            (fileInfo) => {
              setIncomingFile(fileInfo);
              setRole("receiver");
              setStatus("incoming");
            },
            // onProgress
            (prog) => {
              setStatus("transferring");
              setProgress(prog);
            },
            // onComplete
            (info) => {
              setStatus("complete");
              setProgress((prev) => ({ ...prev, ...info }));
              showToast("success", `Received ${info.filename} successfully!`);
            },
            // onError
            (err) => {
              console.error("[Receiver] Error:", err);
              showToast("error", `Receive error: ${err.message}`);
            }
          );
          receiverRef.current = receiver;
        },
        // onStatusChange
        (connState) => {
          if (connState === "failed" || connState === "disconnected") {
            setErrorMessage("Peer connection lost.");
            setStatus("error");
          }
        }
      );

      peerRef.current = { pc, cleanup };
    },
    [showToast]
  );

  // ── Accept Incoming File (called from user click) ───────────────────
  const handleAcceptFile = useCallback(async () => {
    if (receiverRef.current) {
      await receiverRef.current.acceptFile();
    }
  }, []);

  // ── Create Room ─────────────────────────────────────────────────────
  const handleCreateRoom = useCallback(() => {
    setIsConnecting(true);
    const clientId = genClientId();
    clientIdRef.current = clientId;

    const ws = createWebSocket(clientId);
    wsRef.current = ws;

    ws.on("open", () => {
      ws.send({ type: "CREATE_ROOM" });
    });

    ws.on("ROOM_CREATED", (msg) => {
      setRoomId(msg.roomId);
      setView("room");
      setStatus("waiting");
      setIsConnecting(false);
    });

    ws.on("PEER_CONNECTED", () => {
      // Creator is the initiator — creates the data channel
      setupWebRTC(ws, true);
    });

    ws.on("PEER_DISCONNECTED", () => {
      setErrorMessage("Peer disconnected.");
      setStatus("error");
    });

    ws.on("ERROR", (msg) => {
      showToast("error", msg.message);
      setIsConnecting(false);
    });

    ws.on("error", () => {
      showToast("error", "Could not connect to signaling server.");
      setIsConnecting(false);
    });
  }, [setupWebRTC, showToast]);

  // ── Join Room ───────────────────────────────────────────────────────
  const handleJoinRoom = useCallback(
    (code) => {
      setIsConnecting(true);
      const clientId = genClientId();
      clientIdRef.current = clientId;

      const ws = createWebSocket(clientId);
      wsRef.current = ws;

      ws.on("open", () => {
        ws.send({ type: "JOIN_ROOM", roomId: code });
      });

      ws.on("PEER_CONNECTED", (msg) => {
        setRoomId(msg.roomId);
        setView("room");
        setStatus("connected");
        setIsConnecting(false);
        // Joiner is NOT the initiator — waits for data channel
        setupWebRTC(ws, false);
      });

      ws.on("PEER_DISCONNECTED", () => {
        setErrorMessage("Peer disconnected.");
        setStatus("error");
      });

      ws.on("ERROR", (msg) => {
        showToast("error", msg.message);
        setIsConnecting(false);
      });

      ws.on("error", () => {
        showToast("error", "Could not connect to signaling server.");
        setIsConnecting(false);
      });
    },
    [setupWebRTC, showToast]
  );

  // ── Select File ─────────────────────────────────────────────────────
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
  }, []);

  // ── Send File ───────────────────────────────────────────────────────
  const handleSendFile = useCallback(
    async (file) => {
      if (!dcRef.current || dcRef.current.readyState !== "open") {
        showToast("error", "Data channel not ready.");
        return;
      }

      setRole("sender");
      setStatus("transferring");
      setProgress({
        bytesSent: 0,
        totalBytes: file.size,
        percent: 0,
        filename: file.name,
      });

      try {
        await sendFile(dcRef.current, file, (prog) => {
          setProgress((prev) => ({
            ...prev,
            bytesSent: prog.bytesSent,
            percent: prog.percent,
          }));
        });

        setStatus("complete");
        showToast("success", "File sent successfully!");
      } catch (err) {
        console.error("[Sender] Error:", err);
        setErrorMessage(`Send failed: ${err.message}`);
        setStatus("error");
      }
    },
    [showToast]
  );

  // ── Transfer Another (stay in room) ─────────────────────────────────
  const handleTransferAnother = useCallback(() => {
    setStatus("connected");
    setRole(null);
    setSelectedFile(null);
    setProgress(null);
    setIncomingFile(null);
    setErrorMessage("");
  }, []);

  // ── Leave Room ──────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    cleanupAll();
    setView("landing");
    setStatus("idle");
    setRoomId("");
    setRole(null);
    setSelectedFile(null);
    setProgress(null);
    setIsConnecting(false);
    setErrorMessage("");
    setIncomingFile(null);
  }, [cleanupAll]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      {view === "landing" && (
        <Landing
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isConnecting={isConnecting}
        />
      )}

      {view === "room" && (
        <TransferRoom
          roomId={roomId}
          status={status}
          role={role}
          progress={progress}
          onFileSelect={handleFileSelect}
          onSendFile={handleSendFile}
          selectedFile={selectedFile}
          onLeave={handleLeave}
          errorMessage={errorMessage}
          incomingFile={incomingFile}
          onAcceptFile={handleAcceptFile}
          onTransferAnother={handleTransferAnother}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          <span>
            {toast.type === "error" ? "❌" : toast.type === "success" ? "✅" : "ℹ️"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
