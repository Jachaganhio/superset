## ADDED Requirements

### Requirement: Dockerfile.base 提供完整多阶段构建

`Dockerfile.base` SHALL 包含当前项目构建 `lean` target 所需的全部外部依赖安装步骤，包括：拉取 Docker 基础镜像、安装 APT 系统包、执行 `npm ci`、执行 `pip install` 安装所有 Python 依赖。构建通过 `--target` 参数产生两个独立的 base 镜像：

- `superset-node-base:latest` — 从 `--target superset-node` 构建，包含 Node.js、npm、全部 node_modules 和前端编译产物
- `superset-base:latest` — 从 `--target lean` 构建，包含 Python 运行时、全部 pip 包和系统依赖

#### Scenario: 构建 superset-node-base 镜像

- **WHEN** 开发者在有网络环境执行 `docker build -f Dockerfile.base --target superset-node -t superset-node-base:latest .`
- **THEN** 构建过程包含 Node 基础镜像拉取、`apt-get install`、`npm ci`、`npm run build` 等全部前端依赖安装步骤
- **AND** 最终生成 `superset-node-base:latest` 镜像，包含完整的 Node.js 运行时和 node_modules

#### Scenario: 构建 superset-base 镜像

- **WHEN** 开发者在有网络环境执行 `docker build -f Dockerfile.base --target lean -t superset-base:latest .`
- **THEN** 构建过程包含 Python 基础镜像拉取、`apt-get install`、`pip install`、`uv pip install .` 等全部后端依赖安装步骤
- **AND** 最终生成 `superset-base:latest` 镜像，包含完整的 Python 运行时和 pip 包

#### Scenario: 依赖版本未变时 base 镜像可复用

- **WHEN** `package.json`、`package-lock.json`、`requirements/base.txt` 均未修改
- **THEN** 已有的 `superset-node-base:latest` 和 `superset-base:latest` 镜像 SHALL 可被增量 `Dockerfile` 直接作为 `FROM` 基础，无需重新构建 base 镜像

#### Scenario: 依赖变更时重建 base 镜像

- **WHEN** `requirements/base.txt` 或 `package.json` 中任一依赖版本发生变更
- **THEN** 开发者 SHALL 在有网环境执行 `./scripts/build-base.sh` 重建两个 base 镜像
- **AND** 新的 base 镜像 SHALL 包含更新后的依赖版本

### Requirement: Base 镜像可备份和恢复

`superset-node-base:latest` 和 `superset-base:latest` 镜像 SHALL 可通过 `docker save` 导出为 tar 文件，并通过 `docker load` 在另一台机器上恢复。

#### Scenario: 保存 base 镜像到文件

- **WHEN** 开发者执行 `docker save superset-node-base:latest -o superset-node-base.tar` 和 `docker save superset-base:latest -o superset-base.tar`
- **THEN** 生成两个 tar 文件，内容为对应镜像的全部层数据

#### Scenario: 从文件恢复 base 镜像

- **WHEN** 开发者在无 Docker Hub 访问的环境中执行 `docker load -i superset-node-base.tar` 和 `docker load -i superset-base.tar`
- **THEN** 两个 base 镜像出现在本地镜像列表中
- **AND** 可被增量 `Dockerfile` 的 `FROM` 指令引用

### Requirement: build-base.sh 脚本

项目 SHALL 提供 `scripts/build-base.sh` 脚本，封装两个 base 镜像的构建逻辑，在一次调用中依次构建 `superset-node-base:latest` 和 `superset-base:latest`。

#### Scenario: 执行构建脚本

- **WHEN** 开发者在项目根目录执行 `./scripts/build-base.sh`
- **THEN** 脚本先执行 `docker build --target superset-node -t superset-node-base:latest`，再执行 `docker build --target lean -t superset-base:latest`
- **AND** 构建完成后输出两个镜像的成功信息及 ID