#!/usr/bin/env bash
#
# deploy.sh — Build and deploy SiteDeck PM to Hostinger VPS
#
# Prerequisites:
#   1. SSH key exists at ~/.ssh/hostinger-vps-key (or set SSH_KEY env var)
#   2. The public key is already on the server (Hostinger panel or ssh-copy-id -i)
#   3. Make executable: chmod +x deploy.sh
#
# Usage:
#   ./deploy.sh          # full deploy (frontend + backend)
#   ./deploy.sh frontend # frontend only
#   ./deploy.sh backend  # backend only
#

set -euo pipefail

# ─── Config ───
VPS_HOST="${VPS_HOST:-2.24.194.23}"
VPS_USER="${VPS_USER:-root}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/sitedeck-pm}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-/opt/sitedeck-pm/frontend/dist}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-sitedeck-pm}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hostinger-vps-key}"

# SSH/SCP helpers that always use the correct key
ssh_vps() { ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 "${VPS_USER}@${VPS_HOST}" "$@"; }
scp_vps() { scp -i "$SSH_KEY" -o ConnectTimeout=10 "$@"; }

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

DEPLOY_TARGET="${1:-all}"

# ─── Pre-flight checks ───
command -v ssh >/dev/null || error "ssh not found. Install OpenSSH."
command -v scp >/dev/null || error "scp not found. Install OpenSSH."

log "Checking SSH connectivity to ${VPS_USER}@${VPS_HOST} (key: ${SSH_KEY})..."
ssh_vps "echo ok" >/dev/null 2>&1 || {
  error "SSH connection failed. Key not accepted by server.\nEnsure ${SSH_KEY}.pub is in the server's ~/.ssh/authorized_keys."
}

# ─── Build frontend ───
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "frontend" ]; then
  log "Building frontend..."
  cd frontend
  npm ci 2>/dev/null || npm install
  npm run build
  cd ..
fi

# ─── Build backend ───
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "backend" ]; then
  log "Building backend..."
  npm ci 2>/dev/null || npm install
  npm run build
fi

# ─── Deploy frontend ───
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "frontend" ]; then
  log "Uploading frontend/dist to ${VPS_USER}@${VPS_HOST}:${REMOTE_WEB_DIR} ..."
  ssh_vps "mkdir -p ${REMOTE_WEB_DIR}" || true
  scp_vps -r frontend/dist/* "${VPS_USER}@${VPS_HOST}:${REMOTE_WEB_DIR}/"
  log "Frontend deployed."
fi

# ─── Deploy backend ───
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "backend" ]; then
  log "Uploading backend to ${VPS_USER}@${VPS_HOST}:${REMOTE_APP_DIR} ..."

  # Ensure remote dir exists
  ssh_vps "mkdir -p ${REMOTE_APP_DIR}/dist ${REMOTE_APP_DIR}/prisma" || true

  # Sync built backend
  scp_vps -r dist/* "${VPS_USER}@${VPS_HOST}:${REMOTE_APP_DIR}/dist/"

  # Sync package files and Prisma schema
  scp_vps package.json package-lock.json "${VPS_USER}@${VPS_HOST}:${REMOTE_APP_DIR}/"
  scp_vps -r prisma/* "${VPS_USER}@${VPS_HOST}:${REMOTE_APP_DIR}/prisma/"

  # Install deps and restart
  log "Installing production dependencies on VPS..."
  ssh_vps "
    cd ${REMOTE_APP_DIR} &&
    npm ci --production 2>/dev/null || npm install --production &&
    npx prisma generate &&
    npx prisma migrate deploy &&
    sudo systemctl restart ${SYSTEMD_SERVICE} &&
    sudo systemctl status ${SYSTEMD_SERVICE} --no-pager
  " || warn "Remote install/restart had issues. Check manually."

  log "Backend deployed and service restarted."
fi

log "Done. https://projects.sitedeck.pro should reflect changes within seconds."
