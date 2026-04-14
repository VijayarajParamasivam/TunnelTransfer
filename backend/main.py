"""
TunnelTransfer — FastAPI Signaling Server

A stateless WebSocket signaling server for WebRTC peer-to-peer file transfers.
This server NEVER touches file data. It only relays SDP offers/answers and ICE candidates.
"""

import json
import string
import random
from typing import Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TunnelTransfer Signaling Server")

# CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ──────────────────────────────────────────────────────────
# rooms:          { room_id: [client_id_1, client_id_2] }
# client_to_room: { client_id: room_id }
# connections:    { client_id: WebSocket }

rooms: Dict[str, List[str]] = {}
client_to_room: Dict[str, str] = {}
connections: Dict[str, WebSocket] = {}


def generate_room_id(length: int = 6) -> str:
    """Generate a random alphanumeric room code."""
    chars = string.ascii_lowercase + string.digits
    while True:
        code = "".join(random.choices(chars, k=length))
        if code not in rooms:
            return code


async def send_json(ws: WebSocket, data: dict):
    """Send a JSON message to a WebSocket client."""
    await ws.send_text(json.dumps(data))


async def relay_to_peer(sender_id: str, data: dict):
    """Relay a message to the other peer in the same room."""
    room_id = client_to_room.get(sender_id)
    if not room_id or room_id not in rooms:
        return
    for cid in rooms[room_id]:
        if cid != sender_id and cid in connections:
            await send_json(connections[cid], data)


async def cleanup(client_id: str):
    """Remove a client from all tracking structures and notify the peer."""
    connections.pop(client_id, None)
    room_id = client_to_room.pop(client_id, None)
    if room_id and room_id in rooms:
        if client_id in rooms[room_id]:
            rooms[room_id].remove(client_id)
        # Notify remaining peer
        for cid in rooms[room_id]:
            if cid in connections:
                await send_json(connections[cid], {
                    "type": "PEER_DISCONNECTED",
                    "clientId": client_id,
                })
        # Remove empty rooms
        if not rooms[room_id]:
            del rooms[room_id]


# ── WebSocket Endpoint ───────────────────────────────────────────────────────

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(ws: WebSocket, client_id: str):
    await ws.accept()
    connections[client_id] = ws

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            # ── CREATE_ROOM ──────────────────────────────────────────────
            if msg_type == "CREATE_ROOM":
                room_id = generate_room_id()
                rooms[room_id] = [client_id]
                client_to_room[client_id] = room_id
                await send_json(ws, {
                    "type": "ROOM_CREATED",
                    "roomId": room_id,
                })

            # ── JOIN_ROOM ────────────────────────────────────────────────
            elif msg_type == "JOIN_ROOM":
                room_id = msg.get("roomId", "").strip().lower()
                if room_id not in rooms:
                    await send_json(ws, {
                        "type": "ERROR",
                        "message": "Room not found.",
                    })
                elif len(rooms[room_id]) >= 2:
                    await send_json(ws, {
                        "type": "ERROR",
                        "message": "Room is full.",
                    })
                else:
                    rooms[room_id].append(client_id)
                    client_to_room[client_id] = room_id
                    # Notify both peers
                    for cid in rooms[room_id]:
                        if cid in connections:
                            await send_json(connections[cid], {
                                "type": "PEER_CONNECTED",
                                "roomId": room_id,
                                "clients": rooms[room_id],
                            })

            # ── SIGNAL (relay SDP / ICE) ─────────────────────────────────
            elif msg_type == "SIGNAL":
                await relay_to_peer(client_id, {
                    "type": "SIGNAL",
                    "from": client_id,
                    "signal": msg.get("signal"),
                })

            else:
                await send_json(ws, {
                    "type": "ERROR",
                    "message": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Error] client={client_id}: {e}")
    finally:
        await cleanup(client_id)


# ── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "rooms": len(rooms)}
