#!/bin/bash
# Load demo corpus for NOUS
# This script generates and loads a sample mentalization graph

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Generating NOUS demo corpus..."
bun run "$SCRIPT_DIR/generate-demo-corpus.ts"

echo "Demo corpus ready!"
echo "The demo graph is located at: ~/.dyad/mentalization-graph-demo-dyad.json"
echo ""
echo "To use the demo corpus:"
echo "  1. Set DYAD_CONVERSATION_ID=demo-dyad when starting the sidecar"
echo "  2. Call POST /nous/cycle with { budget: 10 }"
echo ""
