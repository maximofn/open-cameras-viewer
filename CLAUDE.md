# Cameras Viewer - Project Documentation

## Description

Local web interface for viewing multiple RTSP security cameras simultaneously. The system uses go2rtc to convert RTSP streams into formats that browsers can play.

## Architecture

```
RTSP Cameras → go2rtc (Docker) → Web Browser
                   ↓
              nginx (Docker)
                   ↓
        Preferences service (Docker)
```

- **go2rtc**: Converts RTSP streams to WebRTC/MSE/MP4/HLS.
- **nginx**: Serves the static web interface.
- **Frontend**: Vanilla HTML/CSS/JS with go2rtc iframes embedded.
- **Preferences service**: Node.js HTTP API that stores `layout`, assignments, and enabled cameras in `data/preferences.json`.

## Project Structure

```
cameras-viewer/
├── .env                   # RTSP credentials (untracked)
├── .env.example           # Configuration template
├── .gitignore             # Ignores .env and system files
├── docker-compose.yml     # Services: go2rtc + nginx + preferences
├── go2rtc.yaml            # Stream configuration
├── entrypoint.sh          # Script to generate go2rtc.yaml from .env
├── data/
│   └── preferences.json   # Persistent file storing layout/cameras
├── preferences-service/
│   └── server.js          # HTTP API for loading/saving preferences
└── web/
    ├── index.html         # Main interface
    ├── styles.css         # Styles (dark theme)
    └── app.js             # UI logic
```

## Configuration

### .env file

Defines the RTSP URLs for the cameras:

```env
ROOM_CAMERA_URL=rtsp://user:password@ip:port/stream1
DOOR_CAMERA_URL=rtsp://user:password@ip:port/
...
```

### go2rtc.yaml

Stream configuration consumed by go2rtc. It is generated automatically from `.env` if you use the split-variable approach (see `entrypoint.sh`). The current project uses environment variables directly.

## Running

### Start the services

```bash
docker-compose up -d
```

### Access the interface

- Main interface: http://localhost:9876
- go2rtc API: http://localhost:1984
- go2rtc WebUI: http://localhost:1984
- Preferences API: http://localhost:9191/preferences

### Stop the services

```bash
docker-compose down
```

## Features

### Layouts

- **1 camera**: Single view
- **2 cameras**: Horizontal split view
- **4 cameras**: 2x2 grid (default)
- **6 cameras**: 3x2 grid
- **7 cameras**: Adaptive 4x2 grid

### Controls

- **Video toggles**: Switches in the header to enable/disable individual cameras
- **Change camera**: "Change" button in the upper-right corner of each slot
- **Persistence**: Layout and visible cameras are stored in localStorage
- **Playback controls**: Built into each iframe (volume, fullscreen, picture-in-picture)

## Technical Details

### Embedded player

The embedded go2rtc player is used via iframes:

```javascript
iframe.src = `${GO2RTC_URL}/stream.html?src=${cameraId}&mode=webrtc,mse,mp4,hls`;
```

**Protocol priority order**:
1. WebRTC (low latency)
2. MSE (Media Source Extensions)
3. MP4
4. HLS

### "MS" indicator

The "MS" (MSE) badge that appears on the cameras indicates the active connection mode. It is hidden using CSS:

```css
.camera-slot iframe {
  margin-top: -30px;
  height: calc(100% + 30px);
}
```

### Preference persistence

Preferences are stored in `data/preferences.json` via the Node.js service exposed at `http://localhost:9191/preferences`. The interface reads values with `GET /preferences` and saves them with `POST /preferences`, so the data survives private browsing sessions or clearing the browser.

### Visual design

The system uses a sleek **Dark Cyber / MCP-inspired** theme with:

- **Main title**: Bold typeface with a white-to-electric-blue gradient, glow effect (`drop-shadow`), and animated "REC" indicator (red pulse).
- **Base colors**: Deep dark palette (#050a14, #0a192f) with radial gradients.
- **Rounded corners**: 16px on camera slots for a more organic, modern look.
- **Spacing**: 1.5rem between cameras for an airier, more professional grid.
- **"Tech" toggles**: Rounded switches with depth (inset shadows) and a subtle electric-blue glow.
- **Layout selector**: Custom dropdown with neon-cyan arrow, blurred background (glassmorphism), and technical vertical marker.
- **Interaction**: Elevation and purple-glow hover effects on camera slots.
- **Picker**: Modal with blurred background (glassmorphism) and backdrop to aid focus.

## Known Issues and Fixes

### WebRTC does not work on Docker macOS

**Issue**: `network_mode: host` does not work on Docker Desktop for macOS. Go2rtc runs behind Docker's internal bridge and advertises ICE candidates with internal IPs (`192.168.65.x`) that the browser cannot reach, pushing the player down to MSE/MP4 with latency.

**Implemented fix**:
1. Configure explicit ICE candidates in `go2rtc.yaml`:
   ```yaml
   webrtc:
     listen: ":8555/tcp"
     candidates:
       - 192.168.1.100:8555  # Replace with your LAN IP
       - 127.0.0.1:8555      # localhost for local access
       - stun:8555
   ```
2. Expose TCP and UDP ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "8555:8555/tcp"
     - "8555:8555/udp"
   ```
3. **Transcode H.265 cameras with AAC audio**: WebRTC does not support H.265 (HEVC) and struggles with AAC audio. For Ezviz cameras (H.265 + AAC), transcode both video and audio:
   ```yaml
   door:
     - ffmpeg:rtsp://admin:PASSWORD@IP/#video=h264#audio=opus
   bedroom_out:
     - ffmpeg:rtsp://admin:PASSWORD@IP/#video=h264#audio=opus
   ```
4. Restart with `docker-compose restart go2rtc` and refresh the browser.

**Note**: Tapo cameras (H.264 + PCMA) work with WebRTC without transcoding. Only Ezviz cameras (H.265 + AAC) need transcoding. Transcoding increases CPU usage in the go2rtc container.

### Firewall blocking Docker

**Issue**: Lulu or other macOS firewalls can block Docker's connections to the local network.

**Solution**: Allow Docker through the firewall.

### Cameras not reachable

**Issue**: Cameras must be on the same network as the host.

**Verification**:
```bash
ping 192.168.1.xxx
nc -zv -w2 192.168.1.xxx 554
```

### ICE candidates timeout with direct WebRTC

**Issue**: ICE candidates do not complete properly on Docker macOS.

**Solution**: Use the embedded go2rtc player instead of implementing WebRTC manually.

## Configured Cameras

1. **Room** (room)
2. **Door** (door)
3. **Bedroom ext.** (bedroom_out)
4. **Kitchen** (kitchen)
5. **Garage** (garage)
6. **Hallway** (hall)
7. **Dining room** (dining_room)
8. ~~**Bedroom** (bedroom)~~ - Disconnected

## Future Changes

### Add/Remove cameras

1. Update `.env` with the new RTSP URL.
2. Update `go2rtc.yaml` with the new stream.
3. Update the `CAMERAS` array in `web/app.js`:

```javascript
const CAMERAS = [
  { id: 'camera_id', name: 'Name' },
  // ...
];
```

### Change ports

Edit `docker-compose.yml`:

```yaml
ports:
  - "8080:80"   # Web port
  - "1984:1984" # go2rtc port
```

### Customize styles

Edit `web/styles.css`. The current theme is **Dark Cyber** optimized for high-tech monitoring.

**Primary colors**:
- Main background: `#050a14` (Cyber Dark)
- Panels (surfaces): `#0a192f` (Deep Navy)
- Primary accent: `#00e5ff` (Electric Blue)
- Secondary accent: `#64ffda` (Cyan)
- Interaction accent: `#bd34fe` (Purple Glow)

## Useful Commands

### View logs

```bash
docker-compose logs -f
docker logs cameras-go2rtc
docker logs cameras-web
```

### Restart services

```bash
docker-compose restart
```

### Check streams in go2rtc

```bash
curl http://localhost:1984/api/streams
```

### Restore saved preferences

Stop the containers and delete/edit `data/preferences.json` to revert to the defaults (4-camera layout, all enabled).

## References

- [go2rtc GitHub](https://github.com/AlexxIT/go2rtc)
- [go2rtc Documentation](https://github.com/AlexxIT/go2rtc/wiki)
- [RTSP Protocol](https://en.wikipedia.org/wiki/Real_Time_Streaming_Protocol)
