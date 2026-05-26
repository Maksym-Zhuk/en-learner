.PHONY: dev setup build

dev:
	npm run dev

setup:
	cp -n .env.example .env.local 2>/dev/null || true
	npm install

build:
	npm run build
