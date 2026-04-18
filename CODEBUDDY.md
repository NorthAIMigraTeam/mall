# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 构建与运行

```bash
# 构建整个项目（pom.xml 中默认 <skipTests>true</skipTests>）
mvn clean package

# 构建单个模块（如 mall-admin，-am 自动构建依赖模块）
mvn clean package -pl mall-admin -am

# 本地启动服务（最低依赖：MySQL + Redis）
cd mall-admin && mvn spring-boot:run
cd mall-portal && mvn spring-boot:run
cd mall-search && mvn spring-boot:run

# 运行测试（需覆盖默认的 skipTests）
mvn test -DskipTests=false

# 运行单个测试类
mvn test -DskipTests=false -pl mall-admin -Dtest=PmsDaoTests

# 重新生成 MyBatis 代码（基于数据库 schema）
cd mall-mbg && mvn mybatis-generator:generate

# Docker：启动基础设施服务
docker-compose -f document/docker/docker-compose-env.yml up -d

# Docker：启动应用服务
docker-compose -f document/docker/docker-compose-app.yml up -d

# 通过 Maven 构建 Docker 镜像（需要 docker.host 指向的 Docker 守护进程）
mvn clean package -Pdocker docker:build
```

## 架构

### 仓库定位

本仓库是 NorthAIMigraTeam 三仓库架构（mall / AIMigraProject / AIDevOps）中的**业务仓库**，仅包含服务源码和 CI 触发配置；部署清单位于 `AIDevOps` 仓库。

### 模块依赖关系

```
mall-common            第 0 层：工具类、CommonResult、Redis 配置、Swagger
    |
    ├── mall-mbg       第 1 层：MyBatis Generator 生成的 mapper/model + Druid + PageHelper
    |
    ├── mall-security  第 1 层：Spring Security + JWT 过滤器，依赖 mall-common
    |
    ├── mall-admin     第 2 层：可部署 - 端口 8080，依赖 mall-mbg + mall-security
    ├── mall-portal    第 2 层：可部署 - 端口 8085，依赖 mall-mbg + mall-security
    ├── mall-search    第 2 层：可部署 - 端口 8081，仅依赖 mall-mbg
    └── mall-demo      第 2 层：仅开发用示例代码
```

### 可部署服务

| 服务 | 端口 | 最低依赖 | 额外依赖 |
|------|------|---------|---------|
| **mall-admin** | 8080 | MySQL, Redis | MinIO / 阿里云 OSS（文件上传） |
| **mall-portal** | 8085 | MySQL, Redis | MongoDB, RabbitMQ, 支付宝 SDK |
| **mall-search** | 8081 | MySQL | Elasticsearch 7.17.3 |

### 业务域与包命名

所有模块共享基础包 `com.macro.mall`，表/实体前缀对应业务域：

| 前缀 | 业务域 | 示例表 |
|------|--------|-------|
| `Cms` | 内容管理 | cms_subject, cms_topic |
| `Oms` | 订单管理 | oms_order, oms_cart_item |
| `Pms` | 商品管理 | pms_product, pms_brand, pms_sku_stock |
| `Sms` | 营销管理 | sms_coupon, sms_flash_promotion |
| `Ums` | 用户管理 | ums_admin, ums_member, ums_role |

### 服务模块代码结构

```
mall-admin/src/main/java/com/macro/mall/
├── config/       # Spring 配置（Security、MyBatis、Swagger、CORS、OSS）
├── controller/   # REST 接口（mall-admin 有 33 个 Controller）
├── dao/          # 自定义 MyBatis 数据访问（手写 SQL，区别于生成代码）
├── dto/          # 请求/响应数据传输对象
├── service/      # 业务逻辑接口
│   └── impl/     # 业务逻辑实现
├── bo/           # 业务对象（如 AdminUserDetails 封装 Spring Security 用户）
└── validator/    # 自定义校验器
```

### 核心共享模块

**mall-common**（`com.macro.mall.common`）：
- `api/CommonResult<T>` — 统一 API 响应封装，所有 Controller 必须使用
- `api/CommonPage<T>` — 分页响应封装（基于 PageHelper）
- `api/ResultCode` — 错误码定义：SUCCESS(200)、FAILED(500)、VALIDATE_FAILED(404)、UNAUTHORIZED(401)、FORBIDDEN(403)
- `exception/` — 全局异常处理器
- `service/RedisService` — Redis 操作封装

**mall-security**（`com.macro.mall.security`）：
- JWT 令牌生成/验证，每个服务可配置独立密钥
- `JwtAuthenticationTokenFilter` — 从 `Authorization` 请求头提取 JWT
- `RestfulAccessDeniedHandler` / `RestAuthenticationEntryPoint` — 自定义 401/403 响应
- `DynamicSecurityService` — 基于 URL 的动态权限校验

**mall-mbg**（`com.macro.mall.mapper` / `com.macro.mall.model`）：
- 由 MyBatis Generator 根据 `generatorConfig.xml` 自动生成
- 约 230 个 mapper 接口 + 对应的 XML 映射文件 + model POJO
- **禁止手动编辑此模块的文件**，如需变更请重新运行 Generator

### 配置

- **Profile**：`dev`（默认）、`prod`
- 配置文件：`src/main/resources/application.yml` + `application-{dev,prod}.yml`
- JWT 密钥按服务隔离：`mall-admin-secret`、`mall-portal-secret`
- Druid 连接池监控：`/druid/`（开发环境登录：druid/druid）
- Swagger 文档：各服务均可通过 `/swagger-ui/` 访问

### 数据库

- 单一 MySQL 数据库 `mall`，所有服务共用
- Schema + 种子数据：`document/sql/mall.sql`（407KB）
- 连接池：阿里 Druid，开发默认参数（初始 5、最小空闲 10、最大 20）

### 基础设施服务（Docker Compose，本地开发用）

定义于 `document/docker/docker-compose-env.yml`。**注意**：以下版本是 mall 开源项目原版的本地开发配置，**生产部署版本见 `AIOps/deploy/k8s/mall/*/middleware/` 下的 K8S YAML**（例如生产 MySQL 为 8.0，对齐 v5 方案 L180）。

| 服务 | 端口 | 用途 |
|------|------|------|
| MySQL 5.7 | 3306 | 主数据库（本地开发；生产为 8.0）|
| Redis 7 | 6379 | 缓存 + 会话 |
| Elasticsearch 7.17.3 | 9200, 9300 | 商品搜索 |
| RabbitMQ 3.9.11 | 5672, 15672 | 订单取消队列 |
| MongoDB 4 | 27017 | Portal 文档存储 |
| MinIO | 9000, 9001 | 对象存储（开发环境） |
| Nginx 1.22 | 80 | 反向代理 |
| Logstash 7.17.3 | 4560-4563 | 日志采集 |
| Kibana 7.17.3 | 5601 | 日志可视化 |

### CI/CD（Argo）

- `ci/argo-workflows/` — 基于 Kaniko 的各服务镜像构建模板
- `ci/argo-events/` — GitHub webhook 事件源，push 时触发构建
- **路径过滤触发**（`ci/argo-events/sensor.yaml`）：`mall-admin/` 下的变更只触发 `build-mall-admin`，`mall-portal/` 和 `mall-search/` 同理
- 构建完成后，Argo Workflows 自动向 `AIDevOps` 仓库提 PR，更新 `deploy/k8s/mall/*/deployment.yaml` 中的镜像 tag

### 部署脚本

- `document/sh/run.sh` — Docker 容器引导脚本（构建镜像、关联依赖、启动）
- `document/sh/mall-admin.sh`、`mall-portal.sh`、`mall-search.sh` — 各服务独立脚本
- `document/sh/Dockerfile` — 通用 Java 8 镜像模板

### 关键开发模式

1. **API 响应**：Controller 中统一使用 `CommonResult.success(data)` / `CommonResult.failed(msg)` 返回
2. **分页**：查询前调用 `PageHelper.startPage(pageNum, pageSize)`，结果用 `CommonPage.restPage(list)` 包装
3. **认证**：JWT 令牌通过 `Authorization: Bearer <token>` 传递，登录接口在 `secure.ignored.urls` 中白名单配置
4. **自定义 SQL**：手写查询放在服务模块的 `dao/` 包，对应 XML 文件在 `src/main/resources/dao/*.xml`，mall-mbg 中的生成代码保持不动
5. **Redis 缓存**：键命名规则定义在各服务 `application.yml` 中（如 `ums:admin`、`ums:resourceList`）
6. **文件上传**：mall-admin 同时支持阿里云 OSS 和 MinIO，配置见 `OssConfig.java` / `MinioController.java`
7. **消息队列**：mall-portal 通过 RabbitMQ 的 `cancelOrderQueue` 队列异步处理订单取消
