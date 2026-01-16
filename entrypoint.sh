#!/bin/sh
# Script that builds go2rtc.yaml from individual environment variables

# Function to build RTSP URL
build_url() {
  local user="$1"
  local pass="$2"
  local ip="$3"
  local port="${4:-554}"
  local stream="${5:-}"

  if [ -n "$stream" ]; then
    echo "rtsp://${user}:${pass}@${ip}:${port}/${stream}"
  elif [ -n "$port" ] && [ "$port" != "554" ]; then
    echo "rtsp://${user}:${pass}@${ip}:${port}/"
  else
    echo "rtsp://${user}:${pass}@${ip}/"
  fi
}

# Generate go2rtc.yaml
cat > /config/go2rtc.yaml << EOF
streams:
  room:
    - $(build_url "$ROOM_CAMERA_USER" "$ROOM_CAMERA_PASSWORD" "$ROOM_CAMERA_IP" "$ROOM_CAMERA_PORT" "$ROOM_CAMERA_STREAM")
  door:
    - $(build_url "$DOOR_CAMERA_USER" "$DOOR_CAMERA_PASSWORD" "$DOOR_CAMERA_IP" "$DOOR_CAMERA_PORT" "$DOOR_CAMERA_STREAM")
  bedroom_out:
    - $(build_url "$BEDROOM_OUT_CAMERA_USER" "$BEDROOM_OUT_CAMERA_PASSWORD" "$BEDROOM_OUT_CAMERA_IP" "$BEDROOM_OUT_CAMERA_PORT" "$BEDROOM_OUT_CAMERA_STREAM")
  kitchen:
    - $(build_url "$KITCHEN_CAMERA_USER" "$KITCHEN_CAMERA_PASSWORD" "$KITCHEN_CAMERA_IP" "$KITCHEN_CAMERA_PORT" "$KITCHEN_CAMERA_STREAM")
  garage:
    - $(build_url "$GARAGE_CAMERA_USER" "$GARAGE_CAMERA_PASSWORD" "$GARAGE_CAMERA_IP" "$GARAGE_CAMERA_PORT" "$GARAGE_CAMERA_STREAM")
  hall:
    - $(build_url "$HALL_CAMERA_USER" "$HALL_CAMERA_PASSWORD" "$HALL_CAMERA_IP" "$HALL_CAMERA_PORT" "$HALL_CAMERA_STREAM")
  dining_room:
    - $(build_url "$DINING_ROOM_USER" "$DINING_ROOM_PASSWORD" "$DINING_ROOM_IP" "$DINING_ROOM_PORT" "$DINING_ROOM_STREAM")
  bedroom:
    - $(build_url "$BEDROOM_CAMERA_USER" "$BEDROOM_CAMERA_PASSWORD" "$BEDROOM_CAMERA_IP" "$BEDROOM_CAMERA_PORT" "$BEDROOM_CAMERA_STREAM")

api:
  listen: ":1984"
  origin: "*"

webrtc:
  listen: ":8555/tcp"
  candidates:
    - stun:8555
EOF

echo "Generated go2rtc.yaml:"
cat /config/go2rtc.yaml

# Start go2rtc (using PATH to find binary)
exec go2rtc -config /config/go2rtc.yaml
