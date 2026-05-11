## 1. Base 镜像构建文件

- [x] 1.1 创建 `Dockerfile.base`，内容等于当前 `Dockerfile` 全量构建逻辑（保留所有 6 个多阶段：superset-node-ci → superset-node → python-base → python-translation-compiler → python-common → lean），最终产出 `lean` target
- [x] 1.2 验证 `Dockerfile.base` 与当前 `Dockerfile` 内容一致（diff 确认无遗漏）

## 2. 增量 Dockerfile 改造

- [x] 2.1 将 `Dockerfile` 的 FROM 链首改为 `FROM superset-base:latest AS superset-node`，保留 `COPY superset-frontend/` 和 `npm run build`，删除所有网络依赖步骤（FROM 基础镜像、apt-get、npm ci、pip install）
- [x] 2.2 将 `Dockerfile` 的 lean target 改为 `FROM superset-base:latest AS lean`，保留 `COPY superset/`，将 `uv pip install .` 改为 `uv pip install --no-deps .`
- [x] 2.3 确保 `COPY --from=superset-node` 跨阶段引用正确，前端编译产物能正确传递到 lean 镜像
- [x] 2.4 保留 Dockerfile 中的 ENV、HEALTHCHECK、CMD、EXPOSE、USER 等运行时配置不变

## 3. Base 构建脚本

- [x] 3.1 创建 `scripts/build-base.sh`，内容为 `docker build -f Dockerfile.base -t superset-base:latest .`
- [x] 3.2 脚本添加错误处理（`set -euo pipefail`）和 ASF license header
- [ ] 3.3 在项目根目录执行 `./scripts/build-base.sh`，验证 base 镜像能成功构建

## 4. 离线构建验证

- [ ] 4.1 确保 `superset-base:latest` 镜像存在后，执行 `docker compose -f docker-compose-non-dev.yml build --no-cache`（或断网环境下 build），验证无网络请求
- [ ] 4.2 用新旧 Dockerfile 分别构建同一份源码，对比最终镜像的 `/app/superset/static/assets` 内容和 Python 包版本一致性
- [ ] 4.3 验证 `docker compose up` 启动后 Superset Web 界面能正常访问

## 5. 部署脚本补充基础设施镜像

- [x] 5.1 修改 `scripts/deploy_superset_images_two_hop.sh`，在 `IMAGES` 数组中追加 `redis:7` 和 `postgres:16`
- [ ] 5.2 执行部署脚本（或 `--precheck-only` 模式），验证新增镜像能被正确 save/upload/load

## 6. 文档

- [x] 6.1 在 `docker/README.md` 中添加 offline build 使用说明：何时需要重建 base 镜像、日常增量构建步骤
