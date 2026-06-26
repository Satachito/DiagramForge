#!/usr/bin/env bash
#	Cursor MCP launcher — always run from tools/ so node_modules resolves.
cd "$(dirname "$0")"
exec node df-mcp.mjs
