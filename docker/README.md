<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Getting Started with Superset using Docker

Docker is an easy way to get started with Superset.

## Prerequisites

1. [Docker](https://www.docker.com/get-started)
2. [Docker Compose](https://docs.docker.com/compose/install/)

## Configuration

The `/app/pythonpath` folder is mounted from [`./docker/pythonpath_dev`](./pythonpath_dev)
which contains a base configuration [`./docker/pythonpath_dev/superset_config.py`](./pythonpath_dev/superset_config.py)
intended for use with local development.

### Local overrides

In order to override configuration settings locally, simply make a copy of [`./docker/pythonpath_dev/superset_config_local.example`](./pythonpath_dev/superset_config_local.example)
into `./docker/pythonpath_dev/superset_config_docker.py` (git ignored) and fill in your overrides.

### Local packages

If you want to add Python packages in order to test things like databases locally, you can simply add a local requirements.txt (`./docker/requirements-local.txt`)
and rebuild your Docker stack.

Steps:

1. Create `./docker/requirements-local.txt`
2. Add your new packages
3. Rebuild docker compose
    1. `docker compose down -v`
    2. `docker compose up`

## Initializing Database

The database will initialize itself upon startup via the init container ([`superset-init`](./docker-init.sh)). This may take a minute.

## Normal Operation

To run the container, simply run: `docker compose up`

After waiting several minutes for Superset initialization to finish, you can open a browser and view [`http://localhost:8088`](http://localhost:8088)
to start your journey.

## Developing

While running, the container server will reload on modification of the Superset Python and JavaScript source code.
Don't forget to reload the page to take the new frontend into account though.

## Production

It is possible to run Superset in non-development mode by using [`docker-compose-non-dev.yml`](../docker-compose-non-dev.yml). This file excludes the volumes needed for development.

## Offline Build (Air-gapped Environments)

If you need to build Superset on a machine without internet access, you can use the base image approach:

### When to Rebuild Base Image

Rebuild the base image (via `./scripts/build-base.sh`) when:
- `package.json` or `package-lock.json` changes (frontend dependencies)
- `requirements/base.txt` changes (Python dependencies)
- You want to update to a new Superset version

The base image contains all external dependencies and can be built once, then reused for many incremental builds.

### How to Build Offline

1. **On a machine with internet**, build the base images:
   ```bash
   ./scripts/build-base.sh
   ```

   This produces two images:
   - `superset-node-base:latest` — Node.js + npm + all frontend dependencies
   - `superset-base:latest` — Python + pip packages + system libraries

2. **Save and transfer** to your offline machine:
   ```bash
   docker save superset-node-base:latest -o superset-node-base.tar
   docker save superset-base:latest -o superset-base.tar
   # Transfer both .tar files to offline machine (via scp, USB, etc.)
   ```

3. **On the offline machine**, load the base image:
   ```bash
   docker load -i superset-base.tar
   ```

4. **Build the app** (no network needed):
   ```bash
   docker compose -f docker-compose-non-dev.yml build
   ```

The incremental build will:
- Copy updated source code
- Run `npm run build` (local frontend compilation)
- Run `uv pip install --no-deps .` (local Python package install)
- All without accessing any network resources

### Deploying to Offline Servers

The deployment script (`scripts/deploy_superset_images_two_hop.sh`) now includes Redis and PostgreSQL images. Run it after building to transfer all required images to your offline target server.

## Resource Constraints

If you are attempting to build on macOS and it exits with 137 you need to increase your Docker resources. See instructions [here](https://docs.docker.com/docker-for-mac/#advanced) (search for memory)
