#!/usr/bin/env bash

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

set -euo pipefail

readonly IMAGES=(
  "superset-superset-init:latest"
  "superset-superset-worker-beat:latest"
  "superset-superset-worker:latest"
  "superset-superset:latest"
)

REMOTE_HOST="172.22.100.108"
REMOTE_USER="pc-01"
REMOTE_DIR="/tmp"

SECOND_HOST="172.23.100.207"
SECOND_USER="superset"
SECOND_DIR='~'

PRECHECK_ONLY=0
CLEANUP_LOCAL=0
CLEANUP_REMOTE=0

readonly SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ARTIFACT_DIR="${PROJECT_ROOT}/tmp/superset-image-deploy-$(date +%Y%m%d%H%M%S)"
CHECKSUM_FILE="${ARTIFACT_DIR}/sha256sum.txt"

ARCHIVE=""

log() {
  printf '[%s] %s\n' "$(date +'%F %T')" "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

sanitize_image_name() {
  printf '%s' "$1" | tr '/:' '__'
}

print_help() {
  cat <<EOF
Usage: ./scripts/deploy_superset_images_two_hop.sh [options]

Save+compress all images into a single archive, upload to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR},
re-upload from ${REMOTE_HOST} to ${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}, then run docker load on host2.

Images (saved as one combined archive to share layers):
  - superset-superset-init:latest
  - superset-superset-worker-beat:latest
  - superset-superset-worker:latest
  - superset-superset:latest

Options:
  --precheck-only     Run checks only; do not save/upload/load images.
  --cleanup-local     Remove local tar.gz and checksum files after success.
  --cleanup-remote    Remove remote files from host1 and host2 after success.
  --help              Show this help.

Environment override:
  REMOTE_HOST REMOTE_USER REMOTE_DIR SECOND_HOST SECOND_USER
EOF
}

parse_args() {
  while (( "$#" )); do
    case "$1" in
      --precheck-only)
        PRECHECK_ONLY=1
        shift
        ;;
      --cleanup-local)
        CLEANUP_LOCAL=1
        shift
        ;;
      --cleanup-remote)
        CLEANUP_REMOTE=1
        shift
        ;;
      --help)
        print_help
        exit 0
        ;;
      --*)
        die "Unsupported flag: $1"
        ;;
      *)
        die "Unexpected argument: $1"
        ;;
    esac
  done
}

apply_env_overrides() {
  REMOTE_HOST="${REMOTE_HOST:-14.103.69.217}"
  REMOTE_USER="${REMOTE_USER:-pc-01}"
  REMOTE_DIR="${REMOTE_DIR:-/tmp}"
  SECOND_HOST="${SECOND_HOST:-172.23.100.207}"
  SECOND_USER="${SECOND_USER:-superset}"
}

check_local_tools() {
  local cmd
  for cmd in docker gzip ssh scp sha256sum; do
    command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: $cmd"
  done
}

check_local_images() {
  local image
  for image in "${IMAGES[@]}"; do
    docker image inspect "$image" >/dev/null 2>&1 || die "Local image not found: $image"
  done
}

check_remote_connectivity() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "echo host1_ok" >/dev/null
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'echo host2_ok'" >/dev/null
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'docker --version >/dev/null'"
}

precheck() {
  log "Running prechecks"
  check_local_tools
  check_local_images
  check_remote_connectivity
  log "Prechecks passed"
}

build_archives() {
  mkdir -p "$ARTIFACT_DIR"

  ARCHIVE="superset-all.tar.gz"
  local archive_path="${ARTIFACT_DIR}/${ARCHIVE}"

  log "Saving and compressing all images -> ${archive_path}"
  docker save "${IMAGES[@]}" | gzip > "$archive_path"
  (cd "$ARTIFACT_DIR" && sha256sum "$ARCHIVE" > "$CHECKSUM_FILE")

  log "Artifacts ready in ${ARTIFACT_DIR}"
}

upload_to_host1() {
  log "Uploading archive to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

  scp "${SSH_OPTS[@]}" "${ARTIFACT_DIR}/${ARCHIVE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
  scp "${SSH_OPTS[@]}" "$CHECKSUM_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "cd '${REMOTE_DIR}' && sha256sum -c '$(basename "$CHECKSUM_FILE")'"
}

relay_to_host2() {
  log "Relaying archive from host1 to ${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "scp ${SSH_OPTS[*]} '${REMOTE_DIR}/${ARCHIVE}' '${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}/'"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "scp ${SSH_OPTS[*]} '${REMOTE_DIR}/$(basename "$CHECKSUM_FILE")' '${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}/'"

  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && sha256sum -c $(basename "$CHECKSUM_FILE")'"
}

load_images_on_host2() {
  local image

  log "Loading images on ${SECOND_USER}@${SECOND_HOST}"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && docker load -i ${ARCHIVE}'"

  for image in "${IMAGES[@]}"; do
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'docker image inspect ${image} >/dev/null'"
  done
}

cleanup_artifacts() {
  if [[ "$CLEANUP_LOCAL" -eq 1 ]]; then
    log "Cleaning local artifacts"
    rm -f "$CHECKSUM_FILE"
    rm -f "${ARTIFACT_DIR}/${ARCHIVE}"
    rmdir "$ARTIFACT_DIR" 2>/dev/null || true
  fi

  if [[ "$CLEANUP_REMOTE" -eq 1 ]]; then
    log "Cleaning remote artifacts"
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "rm -f '${REMOTE_DIR}/${ARCHIVE}'"
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "rm -f '${REMOTE_DIR}/$(basename "$CHECKSUM_FILE")'"
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && rm -f ${ARCHIVE}'"
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && rm -f $(basename "$CHECKSUM_FILE")'"
  fi
}

main() {
  apply_env_overrides
  parse_args "$@"

  log "Host1=${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
  log "Host2=${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}"

  precheck

  if [[ "$PRECHECK_ONLY" -eq 1 ]]; then
    log "Precheck-only mode finished"
    exit 0
  fi

  build_archives
  upload_to_host1
  relay_to_host2
  load_images_on_host2
  cleanup_artifacts

  log "Deployment finished successfully"
}

main "$@"