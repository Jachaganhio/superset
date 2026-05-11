## ADDED Requirements

### Requirement: 部署脚本包含 Redis 镜像

`scripts/deploy_superset_images_two_hop.sh` 的 `IMAGES` 数组 SHALL 包含 `redis:7` 镜像。

#### Scenario: redis 镜像被保存和部署

- **WHEN** 开发者执行 `./scripts/deploy_superset_images_two_hop.sh`
- **THEN** `docker save` 步骤 SHALL 包含 `redis:7` 镜像
- **AND** 该镜像的 tar.gz 文件 SHALL 被上传到跳板机和目标服务器
- **AND** 目标服务器上执行 `docker load` 后，`redis:7` 镜像可用

### Requirement: 部署脚本包含 PostgreSQL 镜像

`scripts/deploy_superset_images_two_hop.sh` 的 `IMAGES` 数组 SHALL 包含 `postgres:16` 镜像。

#### Scenario: postgres 镜像被保存和部署

- **WHEN** 开发者执行 `./scripts/deploy_superset_images_two_hop.sh`
- **THEN** `docker save` 步骤 SHALL 包含 `postgres:16` 镜像
- **AND** 该镜像的 tar.gz 文件 SHALL 被上传到跳板机和目标服务器
- **AND** 目标服务器上执行 `docker load` 后，`postgres:16` 镜像可用

### Requirement: 离线启动完整性

在目标离线服务器上，`docker compose -f docker-compose-non-dev.yml up` SHALL 能成功启动所有服务（redis、db、superset、superset-init、superset-worker、superset-worker-beat）。

#### Scenario: 离线 docker compose up 成功

- **WHEN** 目标服务器已通过部署脚本加载了所有必需镜像（4 个 superset-* + redis:7 + postgres:16）
- **AND** 目标服务器无法访问公网
- **THEN** `docker compose -f docker-compose-non-dev.yml up` SHALL 不触发任何镜像拉取操作
- **AND** 所有 6 个容器正常启动并通过健康检查
