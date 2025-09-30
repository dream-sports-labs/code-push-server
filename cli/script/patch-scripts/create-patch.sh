#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <old_bundle> <new_bundle> <patch_file>"
    echo "Example: $0 originalBundle/index.android.bundle newBundle/index.android.bundle patch/new.patch"
    exit 1
fi

# Convert to absolute paths
OLD_BUNDLE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
NEW_BUNDLE="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
PATCH_FILE="$(cd "$(dirname "$3")" 2>/dev/null && pwd || echo "$(pwd)/$(dirname "$3")")/$(basename "$3")"

echo "Using absolute paths:"
echo "Old bundle: $OLD_BUNDLE"
echo "New bundle: $NEW_BUNDLE"
echo "Patch file: $PATCH_FILE"

# Create patch directory if it doesn't exist
mkdir -p "$(dirname "$PATCH_FILE")"

# Create the patch using bsdiff43
"$SCRIPT_DIR/../bsdiff/bsdiff43" diff "$OLD_BUNDLE" "$NEW_BUNDLE" "$PATCH_FILE"

if [ $? -eq 0 ]; then
    echo "Successfully created patch:"
    echo "Old bundle: $(wc -c < "$OLD_BUNDLE") bytes"
    echo "New bundle: $(wc -c < "$NEW_BUNDLE") bytes"
    echo "Patch size: $(wc -c < "$PATCH_FILE") bytes"
    echo "Patch file: $PATCH_FILE"
    
    # Verify patch format
    if head -c 16 "$PATCH_FILE" | grep -q "ENDSLEY/BSDIFF43"; then
        echo "Verified: Patch is in ENDSLEY/BSDIFF43 format"
    else
        echo "Warning: Patch is not in ENDSLEY/BSDIFF43 format"
    fi
else
    echo "Failed to create patch"
    exit 1
fi
