# mall 仓库 AI 上下文

## 仓库定位

本仓库是 NorthAIMigraTeam 三仓库架构中的**业务仓库**，由研发团队维护。

- 包含 mall 微服务业务源码（Spring Boot 2.7.5 + JDK 8）
- 每个服务目录下含独立 Dockerfile
- `ci/` 目录存放 Argo CI 触发配置（Argo Events + Argo Workflows）

## 全局信息引用

项目背景、全员分工、三仓库关系 → 见 `AIMigraProject/.codebuddy/context/`（权威来源）

## 服务清单

| 服务 | 端口 | 说明 |
|------|------|------|
| mall-admin | 8080 | 后台管理服务 |
| mall-portal | 8085 | 前台门户服务 |
| mall-search | 8081 | 搜索服务（ES） |

## CI 触发规则

见 `ci/argo-events/sensor.yaml`，路径过滤精准触发：
- `mall-admin/` 变更 → 只触发 build-mall-admin
- `mall-portal/` 变更 → 只触发 build-mall-portal
- `mall-search/` 变更 → 只触发 build-mall-search

## CI 完成后

Argo Workflows 自动向 `AIDevOps` 仓库提 PR，更新对应服务 `deploy/k8s/mall/*/deployment.yaml` 中的镜像 tag。
