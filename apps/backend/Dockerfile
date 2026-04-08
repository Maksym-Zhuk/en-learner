FROM rust:1.88-slim AS builder

WORKDIR /app

COPY apps/backend/Cargo.toml apps/backend/Cargo.lock ./apps/backend/
COPY apps/backend/src ./apps/backend/src

WORKDIR /app/apps/backend
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/backend/target/release/en-learner-backend /usr/local/bin/en-learner-backend

ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=3001

EXPOSE 3001

CMD ["en-learner-backend"]
