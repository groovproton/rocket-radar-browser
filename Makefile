.DEFAULT_GOAL := help
PYTHON ?= python3
PORT ?= 8000
HOST ?= 127.0.0.1
PID_FILE := .server.pid
LOG_FILE := .server.log

.PHONY: help run start stop status logs test report

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; print "Rocket Radar — offline commands"} /^[a-zA-Z_-]+:.*## / {printf "  make %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

run: ## Run local server in foreground (Ctrl+C to stop)
	@echo "Rocket Radar: http://$(HOST):$(PORT)/"
	@$(PYTHON) -m http.server $(PORT) --bind $(HOST)

start: ## Start server in background
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "A recorded process is already running (PID $$(cat "$(PID_FILE)")). Run make status."; \
		exit 1; \
	fi
	@rm -f "$(PID_FILE)"
	@nohup $(PYTHON) -m http.server $(PORT) --bind $(HOST) > "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"
	@sleep 1
	@if kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null && curl -fsS -o /dev/null "http://$(HOST):$(PORT)/"; then \
		echo "Rocket Radar started: http://$(HOST):$(PORT)/ (PID $$(cat "$(PID_FILE)"))"; \
	else \
		echo "Server failed to start. See $(LOG_FILE)"; \
		rm -f "$(PID_FILE)"; \
		exit 1; \
	fi

stop: ## Stop the background server started by make start
	@if [ ! -f "$(PID_FILE)" ]; then echo "No managed server PID file."; exit 0; fi
	@pid=$$(cat "$(PID_FILE)"); \
	if ! kill -0 "$$pid" 2>/dev/null; then \
		echo "Stale PID $$pid; cleaning up."; rm -f "$(PID_FILE)"; \
	elif ps -p "$$pid" -o args= | grep -Fq 'http.server $(PORT) --bind $(HOST)'; then \
		kill "$$pid" && rm -f "$(PID_FILE)" && echo "Stopped Rocket Radar (PID $$pid)"; \
	else \
		echo "PID $$pid belongs to a different process. Refusing to stop."; exit 1; \
	fi

status: ## Show server status
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null && \
		ps -p "$$(cat "$(PID_FILE)")" -o args= | grep -Fq 'http.server $(PORT) --bind $(HOST)'; then \
		echo "Running: http://$(HOST):$(PORT)/ (PID $$(cat "$(PID_FILE)"))"; \
	else echo "Managed server is not running."; fi

logs: ## Show server logs (background mode)
	@if [ -f "$(LOG_FILE)" ]; then tail -n 60 "$(LOG_FILE)"; else echo "No log file yet."; fi

test: ## Run BTRUSDT offline test (Node.js CLI; no npm dependencies)
	@node scripts/btr-test.mjs --assert

report: ## Print BTRUSDT signals as JSON
	@node scripts/btr-test.mjs --json
