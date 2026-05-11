## ADDED Requirements

### Requirement: 增量 Dockerfile 从 base 镜像派生

`Dockerfile`（改造后）SHALL 使用两个 base 镜像作为起点：
- 前端阶段 `FROM superset-node-base:latest` — 提供 Node.js 运行时和 node_modules
- 最终阶段 `FROM superset-base:latest` — 提供 Python 运行时和 pip 包

SHALL NOT 包含任何 `apt-get install`、`npm ci`、`pip install`（不含 `--no-deps`）等需要网络访问的指令。

#### Scenario: 增量构建无需网络

- **WHEN** 开发者在断网（或 `--network=none`）环境中执行 `docker compose -f docker-compose-non-dev.yml build`
- **THEN** 构建过程不触发任何外部网络请求
- **AND** 所有 Dockerfile 指令均在本地完成（COPY 源码、npm run build、uv pip install --no-deps）

#### Scenario: 源码修改后增量构建成功

- **WHEN** 开发者修改了 `superset/` 或 `superset-frontend/` 下的源码文件
- **AND** `superset-node-base:latest` 和 `superset-base:latest` 镜像均已存在
- **THEN** `docker compose -f docker-compose-non-dev.yml build` SHALL 成功完成
- **AND** 构建产物包含最新的源码变更

### Requirement: 前端增量构建

增量 `Dockerfile` SHALL 重新 COPY `superset-frontend/` 目录，并执行 `npm run build` 生成最新的前端编译产物。

#### Scenario: 前端源码变更后编译

- **WHEN** 开发者修改了 `superset-frontend/src/` 下的 TypeScript/JavaScript 文件
- **THEN** 增量构建中的 `npm run build` 步骤 SHALL 生成包含最新变更的静态资源文件
- **AND** 通过 `COPY --from` 传递到最终 `lean` 镜像的 `superset/static/assets` 目录

### Requirement: 后端增量安装使用 --no-deps

增量 `Dockerfile` 的 `uv pip install .` 步骤 SHALL 使用 `--no-deps` 标志，确保不触发 PyPI 依赖解析。

#### Scenario: 后端源码变更后安装

- **WHEN** 开发者修改了 `superset/` 下的 Python 源文件
- **THEN** `uv pip install --no-deps .` SHALL 仅安装 superset 包本身
- **AND** 不会尝试连接 PyPI 检查或下载依赖
- **AND** 所有依赖由 base 镜像中已安装的版本提供

### Requirement: 最终镜像内容与改造前一致

增量构建产生的最终 `lean` 镜像 SHALL 与改造前直接运行完整 `Dockerfile` 产生的镜像在功能上完全等价。

#### Scenario: 镜像等价性验证

- **WHEN** 分别用旧 `Dockerfile` 和新 `Dockerfile`（含 base 镜像）构建同一份源码
- **THEN** 两个镜像的 ENTRYPOINT、CMD、EXPOSE、ENV 等元数据一致
- **AND** `/app/superset/` 下的 Python 包行为一致
- **AND** `/app/superset/static/assets` 下的前端产物一致
