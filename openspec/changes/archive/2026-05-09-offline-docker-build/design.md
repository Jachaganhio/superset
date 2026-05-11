## Context

当前 Superset Docker 构建使用单一 `Dockerfile`，包含 6 个多阶段构建（`superset-node-ci` → `superset-node` → `python-base` → `python-translation-compiler` → `python-common` → `lean`）。这 6 个阶段共产生 13 处网络依赖：

| 阶段 | 网络操作 | 来源 |
|------|---------|------|
| superset-node-ci | `FROM node:20-bookworm-slim` | Docker Hub |
| superset-node-ci | `apt-get install build-essential python3 zstd` | Debian APT |
| superset-node-ci | `npm ci` (数百个前端包) | npm registry |
| python-base | `FROM python:3.11.13-slim-bookworm` | Docker Hub |
| python-base | `pip install uv` | PyPI |
| python-translation-compiler | `pip install babel` (清华镜像) | PyPI |
| python-common | `apt-get install curl libsasl2-dev libpq-dev ...` | Debian APT |
| lean | `apt-get install git pkg-config default-libmysqlclient-dev` | Debian APT |
| lean | `pip install -r requirements/base.txt` (100+ 包) | PyPI |
| lean | `uv pip install .` (依赖解析) | PyPI |

Docker 层缓存可以缓解后续构建，但缓存丢失（`docker system prune`、disk 清理、换机器）时，一次冷启动构建需要同时成功访问 4 个外部源，在弱网环境下几乎不可靠。

## Goals / Non-Goals

**Goals:**
- 将日常源码修改后的 Docker 构建变成零网络操作
- 所有外部依赖集中在 `Dockerfile.base` 中，只在依赖版本变更时需要联网重新构建
- 不改变现有 `docker-compose-non-dev.yml` 的接口（用户仍用同一条命令构建）
- 不影响最终镜像内容（`lean` target 产物与改造前完全一致）
- 将 `redis:7` 和 `postgres:16` 纳入部署脚本，确保离线服务器可完整启动

**Non-Goals:**
- 不追求完全离线的一键冷启动（Docker base image 本身仍需要第一次联网拉取）
- 不修改 Superset 运行时行为、Python 依赖树或前端构建流程
- 不引入额外外部工具或 daemon（如 local registry、apt-cacher-ng）

## Decisions

### Decision 1: Base Image 方案优于缓存目录方案

**选择**: 使用 `Dockerfile.base` 构建完整的 `superset-base:latest` 镜像，而非创建 `docker/cache/` 目录存放散文件。

**理由**:
- Docker 镜像天然支持分层、版本管理、压缩传输，本身就是最佳打包格式
- 缓存目录需要为 APT、NPM、PyPI 分别编写下载脚本，维护复杂度高
- Base 镜像通过 `docker save/load` 可以备份、传输、版本标记
- 日常 Dockerfile 只需 `FROM superset-base:latest`，改动极小且直观

**备选方案**: 创建 `docker/cache/` 目录预下载 wheel、.deb、npm cache → 拒绝，因为需要大量脚本维护且 Dockerfile 改动量大

### Decision 2: Dockerfile 拆分策略——需要两个 Base 镜像

**选择**: 需要两个 base 镜像，因为 Docker 多阶段构建中 `FROM <image>:<tag>` 只能引用最终 stage，无法引用中间 stage。

- `superset-node-base:latest` — 从 `Dockerfile.base` 的 `--target superset-node` 构建，包含 Node.js、npm、所有 node_modules 和前端编译产物
- `superset-base:latest` — 从 `Dockerfile.base` 的 `--target lean` 构建，包含 Python 运行时、所有 pip 包和系统依赖

**理由**:
- `FROM superset-base:latest AS superset-node` 会得到 `lean` stage（Python 镜像），没有 `npm` 命令
- Docker 不支持引用多阶段构建中的非最终 stage
- 两个 base 镜像共享中间层，第二次构建（`--target lean`）会复用第一次的缓存

**Dockerfile.base（全量）**:
```dockerfile
# 与当前 Dockerfile 完全一致，所有 FROM/COPY/RUN 不变
# 构建方式:
#   docker build -f Dockerfile.base --target superset-node -t superset-node-base:latest .
#   docker build -f Dockerfile.base --target lean -t superset-base:latest .
```

**Dockerfile（增量）**:
```dockerfile
FROM superset-node-base:latest AS superset-node
# 只覆盖会变的部分
COPY superset-frontend/ /app/superset-frontend/
RUN npm run build

FROM superset-base:latest AS lean
COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets
COPY superset/ /app/superset/
RUN uv pip install --no-deps .
USER superset
```

### Decision 3: `--no-deps` 标志

**选择**: 在增量 `Dockerfile` 中使用 `uv pip install --no-deps .`。

**理由**: base 镜像中已通过 `pip install -r requirements/base.txt` 安装了所有依赖，`--no-deps` 避免 uv 尝试连接 PyPI 做依赖解析，同时确保不引入意外的依赖版本变更。依赖变更应通过重建 base 镜像来反映。

### Decision 4: 部署脚本补充基础设施镜像

**选择**: 在 `deploy_superset_images_two_hop.sh` 的 `IMAGES` 数组中追加 `redis:7` 和 `postgres:16`。

**理由**: 目标服务器 `172.23.100.207` 无法访问公网，`docker compose up` 时如果本地没有这些镜像会直接失败。当前脚本只部署了 4 个 superset-* 镜像，缺少基础设施镜像。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| **Base 镜像体积大** (~3-4 GB 合计) | 两个 base 镜像只在依赖变更时重新构建，日常不传输。日常用 docker save 的仍是 thin app 镜像（与当前一致） |
| **Base 镜像过期**（依赖版本过时） | 提供 `scripts/build-base.sh` 脚本，可随时重建两个 base 镜像。用户在有网环境执行即可 |
| **Docker BuildKit 兼容性** | Base Dockerfile 保留所有 `--mount=type=cache` 指令，确保 BuildKit 缓存机制不变。增量 Dockerfile 不使用 mount，兼容性更好 |
| **dev target 未覆盖** | `docker-compose.yml`（dev 模式）使用 `target: dev`，改造暂不覆盖。Dev 用户通常有稳定网络，且 dev 模式有 volume mount，需求不同 |
| **翻译编译阶段** | `python-translation-compiler` 阶段在 base 中执行，增量 Dockerfile 不重跑。如果翻译文件变更，需重建 base（翻译文件一般随源码一起改） |
| **两个 base 镜像需同步** | `build-base.sh` 在一次调用中依次构建两个镜像，确保版本一致 |

## Migration Plan

1. **创建 `Dockerfile.base`**（等于当前 `Dockerfile` 完整内容）
2. **修改 `Dockerfile`** 为增量形式
3. **在当前有网环境执行一次** `./scripts/build-base.sh`，生成 `superset-node-base:latest` 和 `superset-base:latest`
4. **验证**: `docker compose -f docker-compose-non-dev.yml build` 应能在断网下成功构建
5. **部署**: 日常部署流程（`deploy_superset_images_two_hop.sh`）保持不变，只是 build 更快更可靠了
6. **回滚**: 如需回退，`Dockerfile.base` 内容即原 `Dockerfile`，`git checkout` 原 `Dockerfile` 即可恢复

## Open Questions

- 无。所有技术决策已在探索阶段明确。
