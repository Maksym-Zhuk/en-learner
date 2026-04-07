#!/usr/bin/env bash
# Download webview headers into include/webview/.
# Uses a sparse git clone so only the header files are fetched.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCLUDE_DIR="$SCRIPT_DIR/../include"
WEBVIEW_DIR="$INCLUDE_DIR/webview"

mkdir -p "$INCLUDE_DIR"

if [ -f "$WEBVIEW_DIR/webview.h" ]; then
    echo "webview headers already present at $WEBVIEW_DIR"
else
    echo "Cloning webview headers (sparse clone, headers only)..."
    TMP_DIR=$(mktemp -d)
    trap "rm -rf '$TMP_DIR'" EXIT

    git clone \
        --depth 1 \
        --filter=blob:none \
        --sparse \
        https://github.com/webview/webview \
        "$TMP_DIR"

    (cd "$TMP_DIR" && git sparse-checkout set core/include/webview)

    cp -r "$TMP_DIR/core/include/webview" "$INCLUDE_DIR/"
    echo "Downloaded webview headers to $WEBVIEW_DIR"
fi

# Linux: check for WebKitGTK
if [[ "$(uname)" == "Linux" ]]; then
    echo ""
    echo "Linux detected. Checking WebKitGTK..."
    if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        echo "  ✓ webkit2gtk-4.1 $(pkg-config --modversion webkit2gtk-4.1)"
    elif pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
        echo "  ✓ webkit2gtk-4.0 $(pkg-config --modversion webkit2gtk-4.0)"
        echo "  Note: CMakeLists.txt targets 4.1 — update pkg_check_modules if needed."
    else
        echo "  ✗ WebKitGTK not found. Install with:"
        echo "      Ubuntu/Debian: sudo apt install libwebkit2gtk-4.1-dev"
        echo "      Fedora:        sudo dnf install webkit2gtk4.1-devel"
        echo "      Arch:          sudo pacman -S webkit2gtk-4.1"
    fi
fi

echo ""
echo "Done. Build the desktop shell with:"
echo "  cmake -B build && cmake --build build"
