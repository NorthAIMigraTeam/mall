# 阶段1: 编译构建
FROM maven:3.8.6-openjdk-8-slim AS builder
WORKDIR /build

# 先拷贝 pom 文件利用 Docker 层缓存
COPY pom.xml .
COPY mall-common/pom.xml mall-common/
COPY mall-mbg/pom.xml mall-mbg/
COPY mall-security/pom.xml mall-security/
COPY mall-admin/pom.xml mall-admin/

# 预下载依赖（此层可被缓存）
RUN mvn dependency:go-offline -pl mall-admin -am -q || true

# 拷贝源码
COPY mall-common/ mall-common/
COPY mall-mbg/ mall-mbg/
COPY mall-security/ mall-security/
COPY mall-admin/ mall-admin/

# 构建
RUN mvn package -pl mall-admin -am -DskipTests -B -q

# 阶段2: 运行镜像
FROM openjdk:8-jre-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --from=builder /build/mall-admin/target/mall-admin-*.jar app.jar
RUN chown appuser:appuser app.jar
USER appuser

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
