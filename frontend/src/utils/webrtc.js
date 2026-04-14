/**
 * WebRTC Manager
 *
 * Handles RTCPeerConnection lifecycle, data channel creation,
 * and SDP / ICE signaling through the WebSocket relay.
 */

const turnUsername = import.meta.env.VITE_TURN_USERNAME;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
  ...(turnUsername && turnCredential
    ? [
        {
          urls: "turn:a.relay.metered.ca:80",
          username: turnUsername,
          credential: turnCredential,
        },
        {
          urls: "turn:a.relay.metered.ca:80?transport=tcp",
          username: turnUsername,
          credential: turnCredential,
        },
        {
          urls: "turn:a.relay.metered.ca:443",
          username: turnUsername,
          credential: turnCredential,
        },
        {
          urls: "turns:a.relay.metered.ca:443?transport=tcp",
          username: turnUsername,
          credential: turnCredential,
        },
      ]
    : []),
];

/**
 * Create and manage a WebRTC peer connection.
 *
 * @param {object}   ws           – WebSocket manager (from websocket.js)
 * @param {boolean}  isInitiator  – true if this peer creates the data channel
 * @param {function} onDataChannel – callback(dataChannel) when channel is ready
 * @param {function} onStatusChange – callback(status) for connection state
 * @returns {{ pc: RTCPeerConnection, cleanup: function }}
 */
export function createPeerConnection(
  ws,
  isInitiator,
  onDataChannel,
  onStatusChange
) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // ── ICE candidate trickle ───────────────────────────────────────────
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send({
        type: "SIGNAL",
        signal: { type: "candidate", candidate: event.candidate },
      });
    }
  };

  // ── Connection state monitoring ─────────────────────────────────────
  pc.onconnectionstatechange = () => {
    console.log("[WebRTC] Connection state:", pc.connectionState);
    onStatusChange?.(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[WebRTC] ICE state:", pc.iceConnectionState);
  };

  // ── Data Channel ────────────────────────────────────────────────────
  if (isInitiator) {
    const dc = pc.createDataChannel("fileTransfer", {
      ordered: true,
    });
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      console.log("[WebRTC] DataChannel opened (initiator)");
      onDataChannel(dc);
    };
    dc.onclose = () => console.log("[WebRTC] DataChannel closed (initiator)");

    // Create and send SDP offer
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        ws.send({
          type: "SIGNAL",
          signal: { type: "offer", sdp: pc.localDescription },
        });
      })
      .catch((err) => console.error("[WebRTC] Offer error:", err));
  } else {
    // Receiver: wait for data channel from initiator
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = "arraybuffer";
      dc.onopen = () => {
        console.log("[WebRTC] DataChannel opened (receiver)");
        onDataChannel(dc);
      };
      dc.onclose = () => console.log("[WebRTC] DataChannel closed (receiver)");
    };
  }

  // ── Handle incoming signaling messages ──────────────────────────────
  function handleSignal(msg) {
    const signal = msg.signal;
    if (!signal) return;

    if (signal.type === "offer") {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          ws.send({
            type: "SIGNAL",
            signal: { type: "answer", sdp: pc.localDescription },
          });
        })
        .catch((err) => console.error("[WebRTC] Answer error:", err));
    } else if (signal.type === "answer") {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)).catch(
        (err) => console.error("[WebRTC] Set answer error:", err)
      );
    } else if (signal.type === "candidate") {
      pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((err) =>
        console.error("[WebRTC] Add ICE error:", err)
      );
    }
  }

  ws.on("SIGNAL", handleSignal);

  function cleanup() {
    ws.off("SIGNAL", handleSignal);
    pc.close();
  }

  return { pc, cleanup };
}
