# Cameras Viewer

Interfaz web local para monitorear múltiples cámaras RTSP a la vez usando [go2rtc](https://github.com/AlexxIT/go2rtc). El stack corre en Docker e incluye un servicio de preferencias para recordar layout, cámaras visibles y asignaciones incluso al usar ventanas privadas del navegador.

## Arquitectura

```
Cámaras RTSP ──▶ go2rtc (Docker) ──▶ Navegador (Brave/Safari/Chrome)
                    │
                    └──▶ nginx (Docker) ──▶ Frontend HTML/CSS/JS
                                │
                                └──▶ Servicio de preferencias (Node.js)
```

- **go2rtc** convierte cada stream RTSP en formatos web (WebRTC/MSE/MP4/HLS).
- **nginx** sirve la SPA (`web/`).
- **Servicio de preferencias** (`preferences-service/server.js`) expone `GET/POST /preferences` y persiste los datos en `data/preferences.json`.
- **Frontend** (`web/app.js`) muestra las cámaras dentro de iframes embebidos de go2rtc y consume el API de preferencias.

## Características

- Layouts predefinidos: 1, 2, 4, 6 y 7 cámaras.
- Selector de cámara por slot + toggles individuales para activar/desactivar feeds.
- Preferencias persistentes fuera del navegador (funciona en modo incógnito).
- Tema "Dark Cyber" con efectos de glow y glassmorphism.
- Contenedores gestionados con `docker compose` + script `launch_cameras.sh` que abre Brave y detiene todo al cerrar la ventana.

## Requisitos

- Docker Desktop (macOS/Linux/Windows) con `docker compose` plugin.
- Acceso a las cámaras RTSP desde la máquina host.
- Navegador moderno (Brave recomendado; el script abre Brave automáticamente).

## Configuración

1. Crea tu `.env` con las URLs RTSP (usa `.env.example` como referencia) y asegúrate de mapear cada cámara en `go2rtc.yaml`.
2. Ajusta el array `CAMERAS` en `web/app.js` para reflejar los nombres/IDs utilizados.
3. Opcional: edita los puertos publicados en `docker-compose.yml` (`9876` web, `1984` go2rtc, `9191` preferencias).

## Ejecución

```bash
./launch_cameras.sh
```

El script realiza estos pasos:

1. `docker compose up -d` levanta `go2rtc`, `nginx` y `cameras-preferences`.
2. Abre Brave en modo incógnito en `http://localhost:9876/`, maximizado en la pantalla principal.
3. Queda esperando hasta que cierres la pestaña. Al cerrarla, ejecuta `docker compose stop`.

También puedes manejarlo manualmente:

```bash
docker compose up -d
open -na "Brave Browser" --args --new-window http://localhost:9876/
# ...
docker compose down
```

### Endpoints

- Frontend: `http://localhost:9876`
- go2rtc API/WebUI: `http://localhost:1984`
- Servicio de preferencias: `http://localhost:9191/preferences`

## Preferencias persistentes

- Ubicación del archivo: `data/preferences.json` (montado dentro del contenedor Node).
- Estructura JSON:

```json
{
  "layout": 4,
  "assignments": ["room", "door", "kitchen"],
  "enabledCameras": {"room": true, "door": true}
}
```

- El frontend realiza `GET /preferences` al cargar y `POST /preferences` cada vez que modificas layout, toggles o asignaciones.
- Para restablecer la configuración elimina o edita `data/preferences.json` mientras los contenedores están detenidos.

## Problemas comunes

| Problema | Solución |
| --- | --- |
| Brave no abre o no se posiciona | Consiente a Terminal/osascript en *Privacy → Accessibility* y ejecuta `./launch_cameras.sh` de nuevo. |
| Streams no cargan | Verifica conectividad a la IP de la cámara (`ping`, `nc -zv host 554`) y revisa `go2rtc.yaml`. |
| WebRTC cae a MSE en Docker macOS | Los candidatos ICE deben incluir tanto localhost como la IP LAN. En `go2rtc.yaml` configura `webrtc.candidates` con tu IP LAN, `127.0.0.1` y `stun`. En `docker-compose.yml` expón los puertos `8555/tcp` y `8555/udp`. **Importante**: Cámaras con H.265 o audio AAC necesitan transcodificación: usa `ffmpeg:rtsp://URL/#video=h264#audio=opus` en streams. |
| Preferencias no persisten | Asegúrate de que `cameras-preferences` esté corriendo (`docker compose ps`) y que `data/preferences.json` sea escribible. |

## Desarrollo

- `web/` contiene HTML/CSS/JS sin frameworks. Puedes recargar la página tras editar archivos; nginx sirve directamente desde el volumen.
- `preferences-service/server.js` es un servidor Node básico (sin dependencias externas). Reinicia el contenedor si haces cambios en este archivo.
- `go2rtc.yaml` describe cada stream RTSP (consulta la [documentación oficial](https://github.com/AlexxIT/go2rtc/wiki)).

## Restaurar el entorno

```bash
docker compose down
rm -rf data/preferences.json
```

Al volver a ejecutar `./launch_cameras.sh` se recreará `preferences.json` con la configuración por defecto (layout 4 cámaras, todas habilitadas).
