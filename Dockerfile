#
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
#

######################################################################
# Offline build: Uses pre-built base images with all dependencies
# Build these ONCE when dependencies change:
#   ./scripts/build-base.sh
#
# This produces two base images:
#   superset-node-base:latest  (Node + npm + all npm packages)
#   superset-base:latest       (Python + all pip/system deps)
#
# Then build the app layer (zero network needed):
#   docker compose -f docker-compose-non-dev.yml build
######################################################################

######################################################################
# Stage 1: Frontend build using base image's node toolchain
######################################################################
FROM superset-node-base:latest AS superset-node

WORKDIR /app/superset-frontend

COPY superset-frontend/ /app/superset-frontend/

RUN npm run build

COPY superset/translations /app/superset/translations

######################################################################
# Stage 2: Final lean image using base image's Python environment
######################################################################
FROM superset-base:latest AS lean

USER root

COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets
COPY --from=superset-node /app/superset/translations /app/superset/translations

COPY superset/ /app/superset/

RUN rm -f /app/superset/translations/*/*/*.po || true

RUN uv pip install --no-deps .

RUN python -m compileall /app/superset

USER superset