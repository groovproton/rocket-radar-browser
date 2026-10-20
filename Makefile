SHELL := /bin/sh
PYTHON ?= python3
PORT ?= 8765
HOST ?= 127.0.0.1
PIDFILE := .server.pid
LOGFILE := .server.log
.DEFAULT_GOAL := help
.PHONY: help serve start stop restart status check test test-browser verify-data manifest clean package doctor
help: ## Print available targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
serve: ## Run foreground static HTTP server (Ctrl-C to stop)
	@$(PYTHON) -m http.server $(PORT) --bind $(HOST)
start: ## Start background static HTTP server
	@$(PYTHON) scripts/server_ctl.py start --host $(HOST) --port $(PORT)
stop: ## Stop server started by make start
	@$(PYTHON) scripts/server_ctl.py stop --host $(HOST) --port $(PORT)
restart: ## Restart background server
	@$(PYTHON) scripts/server_ctl.py restart --host $(HOST) --port $(PORT)
status: ## Show server state, pid and application URL
	@$(PYTHON) scripts/server_ctl.py status --host $(HOST) --port $(PORT)
check: ## Validate project layout, metadata and scripts
	@$(PYTHON) scripts/check_project.py
verify-data: ## Verify archived inputs against SHA-256 manifest
	@$(PYTHON) scripts/check_project.py --data
manifest: ## Print dataset index and checksums
	@$(PYTHON) scripts/check_project.py --manifest
test: ## Run local integrity tests; browser unit tests live at /tests.html
	@$(PYTHON) -m unittest discover -s scripts/tests -v
	@echo 'Browser unit tests: http://$(HOST):$(PORT)/tests.html (make start first)'
test-browser: ## Run actual ES module unit tests in headless Chromium (optional dependency)
	@$(PYTHON) scripts/browser_tests.py --port $(PORT)
doctor: ## Check installed tools and environment
	@$(PYTHON) scripts/check_project.py --doctor
clean: ## Remove transient server files
	@$(PYTHON) scripts/server_ctl.py stop --host $(HOST) --port $(PORT)
	@rm -f .server.log .server.pid
package: ## Build distributable project ZIP excluding transient artifacts
	@$(PYTHON) scripts/package.py
