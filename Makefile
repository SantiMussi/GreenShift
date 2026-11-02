# Atajos para quien tenga make (en Windows alcanza con npm run …).
.PHONY: dev demo test setup docker

dev:
	npm run dev

demo:
	npm run demo

test:
	npm test

setup:
	npm run setup

docker:
	docker compose up --build
