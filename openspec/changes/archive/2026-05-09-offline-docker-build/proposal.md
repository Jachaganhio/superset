## Why

本地 `docker compose -f docker-compose-non-dev.yml build` 在构建 Superset 镜像时，需要从 Docker Hub、Debian APT、npm registry、PyPI 共 13 处下载依赖。网络不稳定导致构建频繁在中途失败，重新构建时 Docker 层缓存往往已失效，必须重新联网下载——形成恶性循环。目标是让日常的源码修改和构建完全不需要网络，只在依赖版本变更时才需要一次性联网。

## What Changes

- **新增 `Dockerfile.base`**: 把当前 Dockerfile 中所有联网操作（拉取基础镜像、apt install、npm ci、pip install）保留在 base 文件中。构建一次后生成 `superset-base:latest` 镜像，内含全部系统依赖、前端 node_modules、Python wheel 包及编译产物。
- **改造 `Dockerfile`**: 改为 `FROM superset-base:latest`，删掉所有 apt/npm/pip install 步骤，只保留 `COPY` 源码 + 本地编译（`npm run build`、`uv pip install --no-deps .`）。实现零网络构建。
- **新增 `scripts/build-base.sh`**: 一键构建 base 镜像的脚本，封装 `docker build -f Dockerfile.base -t superset-base:latest .`。
- **修改 `scripts/deploy_superset_images_two_hop.sh`**: 把 `redis:7` 和 `postgres:16` 加入部署镜像列表，确保离线目标服务器也能启动完整服务栈。

## Capabilities

### New Capabilities

- `docker-base-image`: 提供预构建的 superset-base 镜像，内含全部外部依赖和编译产物，作为日常构建的不可变基础层
- `offline-app-build`: Dockerfile 改为从 base 镜像派生的轻量构建流程，COPY 源码 + 本地编译，不触发任何网络请求
- `infra-image-deploy`: 部署脚本覆盖基础设施镜像（redis、postgres），确保离线环境完整可启动

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- **Dockerfile / Dockerfile.base**: 拆分原 Dockerfile，base 保留全量构建逻辑，app 版本变为仅本地操作
- **docker-compose-non-dev.yml**: 无需大改（现有 `build:` 指令可保持不变），但可增加 base 构建 service 或文档说明
- **scripts/deploy_superset_images_two_hop.sh**: IMAGES 数组追加 `redis:7` 和 `postgres:16`
- **scripts/build-base.sh**: 新增
- 不影响 Superset 运行时行为、Python 包依赖、前端构建产物
