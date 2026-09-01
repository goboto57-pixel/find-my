# Dockerfile used both for local/manual builds and for deployment on Render
# (see render.yaml). Builds the React web panel and the Go binary together.
#
# On Render, configure FMD_DATABASEURL (Postgres) so /var/lib/fmd-server/db
# is not relied upon for persistence — Render's disk is ephemeral on the
# free/starter web service plan.

# pnpm 11 requires NodeJS 22, but trixie comes with 20
FROM debian:forky-slim AS builder

ENV NODE_ENV=production

RUN apt update && \
    apt install --no-install-recommends -y ca-certificates git golang zip nodejs npm && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /go/src/fmd-server
ENV CI=true

COPY . .

# Build web frontend, then build Go binary
RUN cd web && \
    npm install -g corepack@latest && \
    corepack enable && \
    pnpm install --frozen-lockfile && \
    pnpm build && \
    cd ..

RUN go build -o /tmp/fmd main.go
RUN go build -o /tmp/fmd-server-ctl ./ctl


FROM debian:13-slim

RUN apt update && \
    apt install --no-install-recommends -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd --no-create-home --uid 1000 fmd-server

# Copy files and configure permissions
# Note that the directories must be executable (for file listing, etc.)

ARG BIN_FILE=/opt/fmd-server
ARG CTL_FILE=/opt/fmd-server-ctl
ARG DB_DIR=/var/lib/fmd-server/db

COPY --from=builder /tmp/fmd "$BIN_FILE"
COPY --from=builder /tmp/fmd-server-ctl "$CTL_FILE"

RUN chown fmd-server:fmd-server "$BIN_FILE" && \
    chmod 0755 "$BIN_FILE"
RUN chown fmd-server:fmd-server "$CTL_FILE" && \
    chmod 0755 "$CTL_FILE"

RUN mkdir -p "$DB_DIR"

RUN chown -R fmd-server:fmd-server "$DB_DIR" && \
    chmod -R 0660 "$DB_DIR" && \
    chmod 0770 "$DB_DIR"

# Change to user
USER fmd-server

EXPOSE 8080/tcp
EXPOSE 8443/tcp
EXPOSE 9100/tcp

# XXX: Using $BIN_FILE doesn't work
ENTRYPOINT ["/opt/fmd-server", "serve", "--db-dir", "/var/lib/fmd-server/db"]
