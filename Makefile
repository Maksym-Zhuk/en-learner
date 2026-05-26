.PHONY: dev backend frontend setup

dev:
	@trap 'kill 0' INT; \
	(cd backend && cargo run) & \
	(sleep 2 && cd frontend && trunk serve) & \
	wait

backend:
	cd backend && cargo run

frontend:
	cd frontend && trunk serve

setup:
	@cp -n .env.example .env 2>/dev/null && echo "Created .env — fill in DATABASE_URL and JWT_SECRET" || echo ".env already exists"
	rustup target add wasm32-unknown-unknown
	cargo install trunk 2>/dev/null || true
