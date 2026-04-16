# 阶段1: 编译构建
FROM maven:3.8.6-openjdk-8-slim AS builder
WORKDIR /build

COPY pom.xml .
COPY mall-common/pom.xml mall-common/
COPY mall-mbg/pom.xml mall-mbg/
COPY mall-security/pom.xml mall-security/
COPY mall-search/pom.xml mall-search/

RUN mvn dependency:go-offline -pl mall-search -am -q || true

COPY mall-common/ mall-common/
COPY mall-mbg/ mall-mbg/
COPY mall-security/ mall-security/
COPY mall-search/ mall-search/

RUN mvn package -pl mall-search -am -DskipTests -Ddocker.skip=true -B -q

# 阶段2: 运行镜像
FROM openjdk:8-jre-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --from=builder /build/mall-search/target/mall-search-*.jar app.jar
RUN chown appuser:appuser app.jar
USER appuser

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:8081/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
