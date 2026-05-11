#!/usr/bin/env bash

# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo " Building superset-base images"
echo "========================================"
echo ""
echo "Step 1/2: Building superset-node-base:latest (Node toolchain + npm deps)..."
echo ""

docker build \
    -f "${PROJECT_ROOT}/Dockerfile.base" \
    --target superset-node \
    -t superset-node-base:latest \
    "${PROJECT_ROOT}"

echo ""
echo "Step 2/2: Building superset-base:latest (Python runtime + pip deps)..."
echo ""

docker build \
    -f "${PROJECT_ROOT}/Dockerfile.base" \
    --target lean \
    -t superset-base:latest \
    "${PROJECT_ROOT}"

echo ""
echo "========================================"
echo " Build complete!"
echo "========================================"
echo ""
echo "Images created:"
echo "  superset-node-base:latest  (Node + npm + frontend node_modules)"
echo "  superset-base:latest       (Python + pip deps + system deps)"
echo ""
echo "To save for transfer to offline machines:"
echo "  docker save superset-node-base:latest -o superset-node-base.tar"
echo "  docker save superset-base:latest -o superset-base.tar"
echo ""
echo "To load on another machine:"
echo "  docker load -i superset-node-base.tar"
echo "  docker load -i superset-base.tar"