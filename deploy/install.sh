#!/usr/bin/env bash
# ===========================================================
# AutoSales AI - One-Command VPS Install Script
# ===========================================================
# Usage:
#   curl -sSL https://raw.githubusercontent.com/adikam/autosales-ai/main/deploy/install.sh | bash
#   -- or --
#   chmod +x deploy/install.sh && ./deploy/install.sh
# ===========================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="${INSTALL_DIR:-/opt/autosales-ai}"
REPO_URL="${REPO_URL:-https://github.com/adikam/autosales-ai.git}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AutoSales AI - Installation Script    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ---------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed.${NC}"
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}Docker installed successfully.${NC}"
else
    echo -e "${GREEN}Docker is installed: $(docker --version)${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose V2 is not available.${NC}"
    echo "Please install Docker Compose V2 (included with Docker Desktop or docker-compose-plugin)."
    exit 1
else
    echo -e "${GREEN}Docker Compose is available: $(docker compose version --short)${NC}"
fi

# ---------------------------------------------------------
# 2. Clone repository
# ---------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/6] Setting up project directory...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
    read -rp "Overwrite? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        sudo rm -rf "$INSTALL_DIR"
    else
        echo "Installation cancelled."
        exit 0
    fi
fi

sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER:$USER" "$INSTALL_DIR"

if [ -n "${REPO_URL:-}" ] && [ "$REPO_URL" != "local" ]; then
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "Using local files (copy mode)..."
    cp -r . "$INSTALL_DIR/"
fi

cd "$INSTALL_DIR"

# ---------------------------------------------------------
# 3. Configure environment
# ---------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/6] Configuring environment...${NC}"

cp .env.example .env

echo ""
echo "Please provide the following configuration values:"
echo "(Press Enter to keep the default value shown in brackets)"
echo ""

read -rp "Anthropic API Key []: " ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
    sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" .env
fi

read -rp "Database Password [change_me_in_production]: " DB_PASS
DB_PASS="${DB_PASS:-change_me_in_production}"
sed -i "s|your_secure_password|$DB_PASS|" .env

read -rp "Email Provider (imap/outlook/gmail) [imap]: " EMAIL_PROV
EMAIL_PROV="${EMAIL_PROV:-imap}"
sed -i "s|EMAIL_PROVIDER=.*|EMAIL_PROVIDER=$EMAIL_PROV|" .env

read -rp "Application Domain [localhost]: " APP_DOM
APP_DOM="${APP_DOM:-localhost}"
sed -i "s|APP_DOMAIN=.*|APP_DOMAIN=$APP_DOM|" .env

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s|generate_a_strong_random_secret_here|$JWT_SECRET|" .env

echo -e "${GREEN}Environment configured.${NC}"

# ---------------------------------------------------------
# 4. Build and start services
# ---------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/6] Building and starting services...${NC}"

docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d

# ---------------------------------------------------------
# 5. Wait for services to be healthy
# ---------------------------------------------------------
echo ""
echo -e "${YELLOW}[5/6] Waiting for services to start...${NC}"

sleep 10

if docker compose -f docker/docker-compose.yml ps | grep -q "running"; then
    echo -e "${GREEN}Services are running.${NC}"
else
    echo -e "${RED}Some services may not be running. Check with:${NC}"
    echo "  docker compose -f docker/docker-compose.yml ps"
    echo "  docker compose -f docker/docker-compose.yml logs"
fi

# ---------------------------------------------------------
# 6. Print success message
# ---------------------------------------------------------
echo ""
echo -e "${YELLOW}[6/6] Installation complete!${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AutoSales AI is now running!          ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Web Dashboard:  ${BLUE}http://${APP_DOM}:3000${NC}"
echo -e "  Agent API:      ${BLUE}http://${APP_DOM}:8000${NC}"
echo -e "  API Docs:       ${BLUE}http://${APP_DOM}:8000/docs${NC}"
echo ""
echo -e "  Install Dir:    ${INSTALL_DIR}"
echo -e "  Config:         ${INSTALL_DIR}/.env"
echo -e "  Agent Config:   ${INSTALL_DIR}/agent-config/"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Configure your email provider settings in .env"
echo "  2. Add your API keys (Anthropic/OpenAI) in .env"
echo "  3. Set up Nginx reverse proxy: see deploy/nginx/autosales.conf"
echo "  4. (Optional) Set up systemd services: see deploy/systemd/"
echo ""
echo "  View logs:    docker compose -f docker/docker-compose.yml logs -f"
echo "  Stop:         docker compose -f docker/docker-compose.yml down"
echo "  Restart:      docker compose -f docker/docker-compose.yml restart"
echo ""
