# Cameras Viewer

Local web interface for monitoring multiple RTSP cameras at once using [go2rtc](https://github.com/AlexxIT/go2rtc). The stack runs in Docker and ships with a preferences service that remembers the layout, visible cameras, and assignments even when you use private browser windows.

## Architecture

```
RTSP Cameras ──▶ go2rtc (Docker) ──▶ Browser (Brave/Safari/Chrome)
                    │
                    └──▶ nginx (Docker) ──▶ HTML/CSS/JS frontend
                                │
                                └──▶ Preferences service (Node.js)
```

- **go2rtc** converts every RTSP stream into web formats (WebRTC/MSE/MP4/HLS).
- **nginx** serves the SPA (`web/`).
- **Preferences service** (`preferences-service/server.js`) exposes `GET/POST /preferences` and persists the data in `data/preferences.json`.
- **Frontend** (`web/app.js`) shows the cameras inside embedded go2rtc iframes and consumes the preferences API.

## Features

- Preset layouts: 1, 2, 4, 6, and 7 cameras.
- Per-slot camera selector plus individual toggles to enable/disable feeds.
- Preferences persisted outside the browser (works in incognito).
- "Dark Cyber" theme with glow and glassmorphism effects.
- Containers managed with `docker compose` + `launch_cameras.sh`, which launches Brave and stops everything when the window closes.

## Requirements

- Docker Desktop (macOS/Linux/Windows) with the `docker compose` plugin.
- Host machine with network access to the RTSP cameras.
- Modern browser (Brave recommended; the script opens Brave automatically).

## Setup

1. Create your `.env` with the RTSP URLs (use `.env.example` as reference) and make sure every camera is mapped in `go2rtc.yaml`.
2. Adjust the `CAMERAS` array in `web/app.js` to reflect the names/IDs in use.
3. Optional: edit the published ports in `docker-compose.yml` (`9876` web, `1984` go2rtc, `9191` preferences).

## Run

```bash
./launch_cameras.sh
```

The script performs these steps:

1. `docker compose up -d` starts `go2rtc`, `nginx`, and `cameras-preferences`.
2. Opens Brave in incognito mode at `http://localhost:9876/`, maximized on the primary display.
3. Waits until you close the tab. When you do, it runs `docker compose stop`.

You can also manage it manually:

```bash
docker compose up -d
open -na "Brave Browser" --args --new-window http://localhost:9876/
# ...
docker compose down
```

### Endpoints

- Frontend: `http://localhost:9876`
- go2rtc API/WebUI: `http://localhost:1984`
- Preferences service: `http://localhost:9191/preferences`

## Persistent preferences

- File location: `data/preferences.json` (mounted inside the Node container).
- JSON structure:

```json
{
  "layout": 4,
  "assignments": ["room", "door", "kitchen"],
  "enabledCameras": {"room": true, "door": true}
}
```

- The frontend issues `GET /preferences` on load and `POST /preferences` every time you change the layout, toggles, or assignments.
- To restore the defaults, delete or edit `data/preferences.json` while the containers are stopped.

## Common issues

| Issue | Fix |
| --- | --- |
| Brave does not open or move | Grant Terminal/osascript permissions in *Privacy → Accessibility* and run `./launch_cameras.sh` again. |
| Streams do not load | Check connectivity to the camera IP (`ping`, `nc -zv host 554`) and review `go2rtc.yaml`. |
| WebRTC falls back to MSE on Docker macOS | ICE candidates must include both localhost and the LAN IP. In `go2rtc.yaml` configure `webrtc.candidates` with your LAN IP, `127.0.0.1`, and `stun`. In `docker-compose.yml` expose ports `8555/tcp` and `8555/udp`. **Important**: Cameras using H.265 or AAC audio need transcoding—use `ffmpeg:rtsp://URL/#video=h264#audio=opus` streams. |
| Preferences do not persist | Ensure `cameras-preferences` is running (`docker compose ps`) and `data/preferences.json` is writable. |

## Development

- `web/` contains framework-free HTML/CSS/JS. Reload the page after editing; nginx serves directly from the volume.
- `preferences-service/server.js` is a minimal Node server (no external deps). Restart the container if you change it.
- `go2rtc.yaml` describes each RTSP stream (see the [official documentation](https://github.com/AlexxIT/go2rtc/wiki)).

## Reset the environment

```bash
docker compose down
rm -rf data/preferences.json
```

When you run `./launch_cameras.sh` again it recreates `preferences.json` with the default configuration (4-camera layout, all enabled).
