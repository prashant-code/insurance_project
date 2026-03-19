#!/bin/bash

# Exit on any error
set -e

echo "======================================"
echo " Building Lightweight Docker Images   "
echo "======================================"

# Support custom tagging from arguments
API_TAG=${1:-"benefit-api:latest"}
UI_TAG=${2:-"benefit-ui:latest"}

echo "[1/2] Building Backend API (Node-Alpine) -> $API_TAG ..."
docker build -t "$API_TAG" ./backend

echo "[2/2] Building Frontend UI (React-Nginx-Alpine) -> $UI_TAG ..."
docker build -t "$UI_TAG" ./frontend

echo ""
echo "======================================"
echo " Build Complete!                      "
echo "======================================"
echo "You can now run:"
echo "  docker run -d -p 3000:3000 $API_TAG"
echo "  docker run -d -p 80:80 $UI_TAG"
