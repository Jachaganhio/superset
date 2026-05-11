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

ARCHIVES=()

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

Save+compress images locally, upload to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR},
re-upload from ${REMOTE_HOST} to ${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}, then run docker load on host2.

Images:
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
  local image file_name out_file

  mkdir -p "$ARTIFACT_DIR"
  : > "$CHECKSUM_FILE"

  for image in "${IMAGES[@]}"; do
    file_name="$(sanitize_image_name "$image").tar.gz"
    out_file="${ARTIFACT_DIR}/${file_name}"
    ARCHIVES+=("$file_name")

    log "Saving and compressing ${image} -> ${out_file}"
    docker save "$image" | gzip > "$out_file"
    (cd "$ARTIFACT_DIR" && sha256sum "$file_name" >> "$(basename "$CHECKSUM_FILE")")
  done

  log "Artifacts ready in ${ARTIFACT_DIR}"
}

upload_to_host1() {
  local file

  log "Uploading archives to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

  for file in "${ARCHIVES[@]}"; do
    scp "${SSH_OPTS[@]}" "${ARTIFACT_DIR}/${file}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
  done
  scp "${SSH_OPTS[@]}" "$CHECKSUM_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "cd '${REMOTE_DIR}' && sha256sum -c '$(basename "$CHECKSUM_FILE")'"
}

relay_to_host2() {
  local file

  log "Relaying archives from host1 to ${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}"
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "scp ${SSH_OPTS[*]} '${REMOTE_DIR}/$(basename "$CHECKSUM_FILE")' '${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}/'"

  for file in "${ARCHIVES[@]}"; do
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "scp ${SSH_OPTS[*]} '${REMOTE_DIR}/${file}' '${SECOND_USER}@${SECOND_HOST}:${SECOND_DIR}/'"
  done

  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
    "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && sha256sum -c $(basename "$CHECKSUM_FILE")'"
}

load_images_on_host2() {
  local i image file

  log "Loading images on ${SECOND_USER}@${SECOND_HOST}"
  for i in "${!IMAGES[@]}"; do
    image="${IMAGES[$i]}"
    file="${ARCHIVES[$i]}"

    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && docker load -i ${file}'"

    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'docker image inspect ${image} >/dev/null'"
  done
}

cleanup_artifacts() {
  local file

  if [[ "$CLEANUP_LOCAL" -eq 1 ]]; then
    log "Cleaning local artifacts"
    rm -f "$CHECKSUM_FILE"
    for file in "${ARCHIVES[@]}"; do
      rm -f "${ARTIFACT_DIR}/${file}"
    done
    rmdir "$ARTIFACT_DIR" 2>/dev/null || true
  fi

  if [[ "$CLEANUP_REMOTE" -eq 1 ]]; then
    log "Cleaning remote artifacts"
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
      "rm -f '${REMOTE_DIR}/$(basename "$CHECKSUM_FILE")'"
    for file in "${ARCHIVES[@]}"; do
      ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
        "rm -f '${REMOTE_DIR}/${file}'"
      ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" \
        "ssh ${SSH_OPTS[*]} ${SECOND_USER}@${SECOND_HOST} 'cd ~ && rm -f ${file}'"
    done
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