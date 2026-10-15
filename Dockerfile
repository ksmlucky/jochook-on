# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /src
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile
COPY frontend ./frontend
COPY docs/guides/content.json docs/guides/jochook-on-member-guide.pdf docs/guides/jochook-on-staff-guide.pdf ./docs/guides/
RUN pnpm build

FROM eclipse-temurin:21-jdk-jammy AS backend-build
WORKDIR /src
COPY backend/gradlew backend/build.gradle backend/settings.gradle ./
COPY backend/gradle ./gradle
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.gradle bash ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre-jammy AS api
RUN apt-get update && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 jochookon && useradd --uid 10001 --gid jochookon --no-create-home jochookon
WORKDIR /app
COPY --from=backend-build /src/build/libs/*-SNAPSHOT.jar ./app.jar
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://127.0.0.1:8080/actuator/health > /dev/null || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60.0", "-jar", "/app/app.jar"]

FROM caddy:2-alpine AS web-northflank
COPY deploy/Caddyfile.northflank /etc/caddy/Caddyfile
RUN JOCHOOK_ON_SITE_HOST=check.invalid JOCHOOK_ON_API_UPSTREAM=api:8080 JOCHOOK_ON_TRUSTED_PROXY_CIDRS=127.0.0.1/32 \
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
COPY --from=frontend-build /src/frontend/dist /srv
EXPOSE 8080

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /src/frontend/dist /srv
