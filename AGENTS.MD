# Cameras Viewer - Documentación del Proyecto

## Descripción

Interfaz web local para visualizar múltiples cámaras de seguridad RTSP simultáneamente. El sistema utiliza go2rtc para convertir streams RTSP a formatos compatibles con navegadores web.

## Arquitectura

```
Cámaras RTSP → go2rtc (Docker) → Navegador Web
                   ↓
              nginx (Docker)
                   ↓
        Servicio de preferencias (Docker)
```

- **go2rtc**: Convierte streams RTSP a WebRTC/MSE/MP4/HLS
- **nginx**: Sirve la interfaz web estática
- **Frontend**: HTML/CSS/JS vanilla con iframes embebidos de go2rtc
- **Servicio de preferencias**: API HTTP Node.js que guarda `layout`, asignaciones y cámaras habilitadas en `data/preferences.json`

## Estructura del Proyecto

```
cameras-viewer/
├── .env                   # Credenciales RTSP (no versionado)
├── .env.example          # Plantilla de configuración
├── .gitignore            # Ignora .env y archivos del sistema
├── docker-compose.yml    # Servicios: go2rtc + nginx + preferencias
├── go2rtc.yaml          # Configuración de streams
├── entrypoint.sh        # Script para generar go2rtc.yaml desde .env
├── data/
│   └── preferences.json # Archivo persistente con layout/cámaras
├── preferences-service/
│   └── server.js        # API HTTP para cargar/guardar preferencias
└── web/
    ├── index.html       # Interfaz principal
    ├── styles.css       # Estilos (tema oscuro)
    └── app.js           # Lógica UI
```

## Configuración

### Archivo .env

Define las URLs RTSP de las cámaras:

```env
ROOM_CAMERA_URL=rtsp://usuario:contraseña@ip:puerto/stream1
DOOR_CAMERA_URL=rtsp://usuario:contraseña@ip:puerto/
...
```

### go2rtc.yaml

Configuración de streams que go2rtc utiliza. Se genera automáticamente desde `.env` si se usa el enfoque de variables separadas (ver `entrypoint.sh`). En el proyecto actual se usa directamente con variables de entorno.

## Ejecución

### Iniciar los servicios

```bash
docker-compose up -d
```

### Acceder a la interfaz

- Interfaz principal: http://localhost:9876
- API de go2rtc: http://localhost:1984
- WebUI de go2rtc: http://localhost:1984
- API de preferencias: http://localhost:9191/preferences

### Detener los servicios

```bash
docker-compose down
```

## Funcionalidades

### Layouts

- **1 cámara**: Vista individual
- **2 cámaras**: Vista dividida horizontal
- **4 cámaras**: Grid 2x2 (por defecto)
- **6 cámaras**: Grid 3x2
- **7 cámaras**: Grid 4x2 adaptativo

### Controles

- **Toggles de vídeo**: Switches en el header para activar/desactivar cámaras individuales
- **Cambio de cámara**: Botón "Cambiar" en la esquina superior derecha de cada slot
- **Persistencia**: Las preferencias de layout y cámaras visibles se guardan en localStorage
- **Controles de reproducción**: Integrados en cada iframe (volumen, fullscreen, picture-in-picture)

## Detalles Técnicos

### Player Embebido

Se usa el player embebido de go2rtc via iframes:

```javascript
iframe.src = `${GO2RTC_URL}/stream.html?src=${cameraId}&mode=webrtc,mse,mp4,hls`;
```

**Orden de prioridad de protocolos**:
1. WebRTC (baja latencia)
2. MSE (Media Source Extensions)
3. MP4
4. HLS

### Indicador "MS"

El indicador "MS" (MSE) que aparece en las cámaras indica el modo de conexión activo. Se oculta mediante CSS:

```css
.camera-slot iframe {
  margin-top: -30px;
  height: calc(100% + 30px);
}
```

### Persistencia de Preferencias

Las preferencias se guardan en `data/preferences.json` mediante el servicio Node.js expuesto en `http://localhost:9191/preferences`. La interfaz lee los valores con `GET /preferences` y los guarda con `POST /preferences`, por lo que se preservan incluso en navegación privada o al limpiar el navegador.

### Diseño Visual

El sistema usa un tema **Dark Cyber / MCP-inspired** moderno con:

- **Título Principal**: Tipografía audaz con degradado de blanco a azul eléctrico, efecto de brillo (`drop-shadow`) e indicador visual "REC" animado (pulso rojo).
- **Colores base**: Paleta oscura profunda (#050a14, #0a192f) con gradientes radiales.
- **Bordes redondeados**: 16px en los slots de cámara para un look más orgánico y moderno.
- **Espaciado**: 1.5rem entre cámaras para una cuadrícula más aireada y profesional.
- **Toggles "Tech"**: Switches redondeados con profundidad visual (inset shadows) y brillo azul eléctrico sutil.
- **Selector de Layout**: Desplegable personalizado con flecha cian neón, fondo con desenfoque (glassmorphism) y marcador vertical técnico.
- **Interacción**: Efectos de elevación y brillo (glow) púrpura al pasar el ratón por los slots de cámara.
- **Selector**: Modal con fondo desenfocado (glassmorphism) y backdrop para mejorar la concentración.

## Problemas Conocidos y Soluciones

### WebRTC no funciona en Docker macOS

**Problema**: `network_mode: host` no funciona en Docker Desktop para macOS. Go2rtc corre detrás del bridge interno de Docker y cuando responde la negociación ICE, anuncia candidatos con IPs internas (`192.168.65.x`) que el navegador no puede alcanzar, causando que el player caiga a MSE/MP4 con latencia.

**Solución implementada**:
1. Configurar candidatos ICE explícitos en `go2rtc.yaml`:
   ```yaml
   webrtc:
     listen: ":8555/tcp"
     candidates:
       - 192.168.1.100:8555  # Replace with your LAN IP
       - 127.0.0.1:8555        # localhost para acceso local
       - stun:8555
   ```
2. Exponer puertos TCP y UDP en `docker-compose.yml`:
   ```yaml
   ports:
     - "8555:8555/tcp"
     - "8555:8555/udp"
   ```
3. **Transcodificar cámaras H.265 con audio AAC**: WebRTC no soporta H.265 (HEVC) ni maneja bien el audio AAC. Para las cámaras Ezviz (H.265 + AAC), transcodificar tanto video como audio:
   ```yaml
   door:
     - ffmpeg:rtsp://admin:PASSWORD@IP/#video=h264#audio=opus
   bedroom_out:
     - ffmpeg:rtsp://admin:PASSWORD@IP/#video=h264#audio=opus
   ```
4. Reiniciar con `docker-compose restart go2rtc` y refrescar el navegador.

**Nota**: Las cámaras Tapo (H.264 + PCMA) funcionan con WebRTC sin transcodificación. Solo las cámaras Ezviz (H.265 + AAC) necesitan transcodificación. La transcodificación consume más CPU en el contenedor go2rtc.

### Firewall bloqueando Docker

**Problema**: Lulu u otros firewalls de macOS pueden bloquear las conexiones de Docker a la red local.

**Solución**: Dar permisos al firewall para permitir conexiones de Docker.

### Cámaras no accesibles

**Problema**: Las cámaras deben estar en la misma red que el host.

**Verificación**:
```bash
ping 192.168.1.xxx
nc -zv -w2 192.168.1.xxx 554
```

### ICE candidates timeout con WebRTC directo

**Problema**: Los ICE candidates no se completan correctamente en Docker macOS.

**Solución**: Usar el player embebido de go2rtc en lugar de implementar WebRTC manualmente.

## Cámaras Configuradas

1. **Habitación** (room)
2. **Puerta** (door)
3. **Dormitorio ext.** (bedroom_out)
4. **Cocina** (kitchen)
5. **Garaje** (garage)
6. **Pasillo** (hall)
7. **Comedor** (dining_room)
8. ~~**Dormitorio** (bedroom)~~ - Desconectada

## Modificaciones Futuras

### Agregar/Quitar Cámaras

1. Actualizar `.env` con la nueva URL RTSP
2. Actualizar `go2rtc.yaml` con el nuevo stream
3. Actualizar el array `CAMERAS` en `web/app.js`:

```javascript
const CAMERAS = [
  { id: 'camera_id', name: 'Nombre' },
  // ...
];
```

### Cambiar Puertos

Editar `docker-compose.yml`:

```yaml
ports:
  - "8080:80"   # Puerto web
  - "1984:1984" # Puerto go2rtc
```

### Personalizar Estilos

Editar `web/styles.css`. El tema actual es **Dark Cyber** optimizado para visualización de alta tecnología.

**Colores principales**:
- Fondo principal: `#050a14` (Cyber Dark)
- Paneles (Surfaces): `#0a192f` (Deep Navy)
- Acento Primario: `#00e5ff` (Electric Blue)
- Acento Secundario: `#64ffda` (Cyan)
- Acento de Interacción: `#bd34fe` (Purple Glow)

## Comandos Útiles

### Ver logs

```bash
docker-compose logs -f
docker logs cameras-go2rtc
docker logs cameras-web
```

### Reiniciar servicios

```bash
docker-compose restart
```

### Verificar streams en go2rtc

```bash
curl http://localhost:1984/api/streams
```

### Restaurar preferencias guardadas

Detén los contenedores y elimina/edita `data/preferences.json` para volver a los valores por defecto (layout 4 cámaras, todas habilitadas).

## Referencias

- [go2rtc GitHub](https://github.com/AlexxIT/go2rtc)
- [go2rtc Documentation](https://github.com/AlexxIT/go2rtc/wiki)
- [RTSP Protocol](https://en.wikipedia.org/wiki/Real_Time_Streaming_Protocol)
