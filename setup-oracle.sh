#!/bin/bash
# Oracle Cloud Deployment Setup Script
# This script configures and deploys the Cameras Viewer application on Oracle Cloud

set -e  # Exit on error

echo "=========================================="
echo "  Cameras Viewer - Oracle Cloud Setup"
echo "=========================================="
echo ""

# Step 1: Get public IP from Oracle Cloud metadata service
echo "[1/5] Obtaining public IP from Oracle Cloud metadata..."
PUBLIC_IP=$(curl -s http://169.254.169.254/opc/v1/instance/metadata | jq -r .publicIp)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" = "null" ]; then
  echo "❌ Error: Could not obtain public IP from Oracle Cloud metadata service"
  echo "   Make sure you're running this on an Oracle Cloud instance"
  echo "   If running locally, use docker-compose.yml instead"
  exit 1
fi

echo "✅ Public IP detected: $PUBLIC_IP"
echo ""

# Step 2: Inject public IP into go2rtc configuration
echo "[2/5] Configuring go2rtc with public IP..."
if [ ! -f "go2rtc.cloud.yaml" ]; then
  echo "❌ Error: go2rtc.cloud.yaml not found"
  exit 1
fi

sed "s/REPLACE_WITH_PUBLIC_IP/$PUBLIC_IP/g" go2rtc.cloud.yaml > go2rtc.yaml
echo "✅ go2rtc.yaml generated with IP: $PUBLIC_IP"
echo ""

# Step 3: Copy cloud docker-compose configuration
echo "[3/5] Setting up docker-compose for cloud deployment..."
if [ ! -f "docker-compose.cloud.yml" ]; then
  echo "❌ Error: docker-compose.cloud.yml not found"
  exit 1
fi

cp docker-compose.cloud.yml docker-compose.yml
echo "✅ docker-compose.yml configured for cloud (port 80)"
echo ""

# Step 4: Pull Docker images and start services
echo "[4/5] Pulling Docker images and starting services..."
docker-compose pull
docker-compose up -d
echo "✅ Services started successfully"
echo ""

# Step 5: Display access URLs
echo "[5/5] Deployment complete!"
echo ""
echo "=========================================="
echo "  Access URLs"
echo "=========================================="
echo "🌐 Main Interface:   http://$PUBLIC_IP"
echo "🔧 go2rtc WebUI:     http://$PUBLIC_IP:1984"
echo "📊 go2rtc API:       http://$PUBLIC_IP:1984/api"
echo "⚙️  Preferences API:  http://$PUBLIC_IP:9191/preferences"
echo ""
echo "📝 Note: Make sure the following ports are open in Oracle Cloud Security Lists:"
echo "   - Port 80 (HTTP) - Main interface"
echo "   - Port 1984 (TCP) - go2rtc API/WebUI"
echo "   - Port 8555 (TCP/UDP) - WebRTC"
echo "   - Port 9191 (TCP) - Preferences API"
echo ""
echo "✨ Deployment successful! Open http://$PUBLIC_IP in your browser"
echo "=========================================="
