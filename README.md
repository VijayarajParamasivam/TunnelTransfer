# TunnelTransfer

**Peer-to-peer file transfer.** No servers, no limits, no traces.

Two users join a private room and transfer files directly over WebRTC — zero file data touches the server.

## Architecture

```
Browser A ──WebRTC DataChannel──▶ Browser B
     │                                │
     └──WebSocket (signaling only)──┘
              FastAPI Server
```

- **Signaling Server** (FastAPI): Relays SDP offers/answers and ICE candidates only
- **File Transfer**: Direct peer-to-peer via `RTCDataChannel`
- **Disk Streaming**: Uses File System Access API (`showSaveFilePicker`) to write chunks directly to disk

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Transfer a File

1. Open the app in **two browser tabs** (Chrome/Edge)
2. Click **Create Room** in Tab A → copy the room code
3. Paste the code in Tab B → click **Join Room**
4. Drop a file in Tab A → click **Send File**
5. Tab B picks a save location → file streams directly to disk

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI + Uvicorn |
| Networking | WebSocket (signaling) + WebRTC DataChannel (transfer) |
| Disk I/O | File System Access API |
| STUN | `stun:stun.l.google.com:19302` |

## Key Safety Features

- **Backpressure Control**: Monitors `dataChannel.bufferedAmount` (16MB threshold) to prevent RAM overflow
- **64KB Chunking**: Files are read and sent in strict 64KB slices
- **Stream-to-Disk**: Receiver writes each chunk directly via `FileSystemWritableFileStream` — no Blob accumulation

## Browser Support

Requires **Chromium-based browsers** (Chrome, Edge, Opera) for the File System Access API.
