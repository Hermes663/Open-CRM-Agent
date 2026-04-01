#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/autosales-ai}"
REPO_URL="${REPO_URL:-https://github.com/Hermes663/Open-CRM-Agent.git}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AutoSales AI - Installation Script    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}Docker is not installed.${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}Docker installed successfully.${NC}"
else
    echo -e "${GREEN}Docker is installed: $(docker --version)${NC}"
fi

if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}Docker Compose V2 is not available.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}[2/6] Preparing project directory...${NC}"

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
git clone "$REPO_URL" "$INSTALL_DIR"

cd "$INSTALL_DIR"

echo ""
echo -e "${YELLOW}[3/6] Configuring environment...${NC}"

cp .env.example .env

read -rp "Database password [change_me_in_production]: " DB_PASS
DB_PASS="${DB_PASS:-change_me_in_production}"
sed -i "s|your_secure_password|$DB_PASS|g" .env

read -rp "JWT secret (leave empty to generate): " JWT_SECRET
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
sed -i "s|generate_a_strong_random_secret_here|$JWT_SECRET|g" .env

read -rp "LLM provider [anthropic]: " LLM_PROVIDER
LLM_PROVIDER="${LLM_PROVIDER:-anthropic}"
sed -i "s|LLM_PROVIDER=.*|LLM_PROVIDER=$LLM_PROVIDER|" .env

if [ "$LLM_PROVIDER" = "anthropic" ]; then
    read -rp "Anthropic API key: " ANTHROPIC_KEY
    sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" .env
fi

if [ "$LLM_PROVIDER" = "openai" ]; then
    read -rp "OpenAI API key: " OPENAI_KEY
    sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" .env
fi

read -rp "Email provider (imap/outlook/gmail) [imap]: " EMAIL_PROVIDER
EMAIL_PROVIDER="${EMAIL_PROVIDER:-imap}"
sed -i "s|EMAIL_PROVIDER=.*|EMAIL_PROVIDER=$EMAIL_PROVIDER|" .env

echo -e "${GREEN}Environment configured.${NC}"

echo ""
echo -e "${YELLOW}[4/6] Starting database...${NC}"

docker compose -f docker/docker-compose.yml up -d db

until [ "$(docker inspect -f '{{.State.Health.Status}}' autosales-db 2>/dev/null || true)" = "healthy" ]; do
    echo "Waiting for PostgreSQL to become healthy..."
    sleep 2
done

echo ""
echo -e "${YELLOW}[5/6] Applying database migrations and starting application services...${NC}"

bash scripts/db_migrate.sh
docker compose -f docker/docker-compose.yml up -d web agent

echo ""
echo -e "${YELLOW}[6/6] Installation complete${NC}"
echo ""
echo -e "${GREEN}Dashboard:${NC}  http://localhost:3000"
echo -e "${GREEN}Agent API:${NC}  http://localhost:8000"
echo -e "${GREEN}API Docs:${NC}   http://localhost:8000/docs"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker/docker-compose.yml ps"
echo "  docker compose -f docker/docker-compose.yml logs -f"
echo "  bash scripts/db_seed.sh   # optional demo data"
