#!/bin/bash

# Convert all .ppt files to .pptx using LibreOffice with parallel processing
# Usage: ./convert-ppt-to-pptx.sh [directory] [workers]
# Default directory: /Users/iosif/Downloads/Cantari power point/
# Default workers: 4

set -euo pipefail

SOURCE_DIR="${1:-/Users/iosif/Downloads/Cantari power point/}"
WORKERS="${2:-4}"
TEMP_DIR="/tmp/ppt-convert-$$"
LOG_DIR="$TEMP_DIR/logs"
PROFILE_DIR="$TEMP_DIR/profiles"

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    # Kill any remaining soffice processes from our profiles
    pkill -f "UserInstallation=file://$PROFILE_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory does not exist: $SOURCE_DIR"
    exit 1
fi

# Check if LibreOffice is installed
if ! command -v soffice &> /dev/null; then
    echo "Error: LibreOffice (soffice) is not installed or not in PATH"
    echo "Install it with: brew install --cask libreoffice"
    exit 1
fi

# Create temp directories
mkdir -p "$LOG_DIR" "$PROFILE_DIR"

# Fix permissions on source directory and all subdirectories
echo "Fixing directory permissions..."
find "$SOURCE_DIR" -type d -exec chmod u+w {} \; 2>/dev/null || true

# Fix permissions on all PPT files
echo "Fixing file permissions..."
find "$SOURCE_DIR" -iname "*.ppt" -type f -exec chmod u+w {} \; 2>/dev/null || true

echo "Permissions fixed."
echo ""

# Count total .ppt files
total=$(find "$SOURCE_DIR" -iname "*.ppt" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Found $total .ppt/.PPT files to convert in: $SOURCE_DIR"
echo "Using $WORKERS parallel workers"
echo ""

if [ "$total" -eq 0 ]; then
    echo "No .ppt files found"
    exit 0
fi

# Create file list
FILE_LIST="$TEMP_DIR/files.txt"
find "$SOURCE_DIR" -iname "*.ppt" -type f > "$FILE_LIST"

# Create the worker script that will be used by both parallel and xargs
WORKER_SCRIPT="$TEMP_DIR/worker.sh"
cat > "$WORKER_SCRIPT" << 'WORKER_EOF'
#!/bin/bash
ppt_file="$1"
worker_id="$2"
profile_dir="$3"

dir_path=$(dirname "$ppt_file")
original_filename=$(basename "$ppt_file")
filename="${original_filename%.[pP][pP][tT]}"

# Normalize filename
normalized_filename=$(echo "$filename" | tr '[:upper:]' '[:lower:]')
normalized_filename="$(echo "${normalized_filename:0:1}" | tr '[:lower:]' '[:upper:]')${normalized_filename:1}"
normalized_filename=$(echo "$normalized_filename" | sed -E 's/\bisus([eul]*)\b/Isus\1/gi')
normalized_filename=$(echo "$normalized_filename" | sed -E 's/\bhristos([eul]*)\b/Hristos\1/gi')
normalized_filename=$(echo "$normalized_filename" | sed -E 's/\bcristos([eul]*)\b/Cristos\1/gi')
normalized_filename=$(echo "$normalized_filename" | sed -E 's/\bdumnezeu([lui]*)\b/Dumnezeu\1/gi')
normalized_filename=$(echo "$normalized_filename" | sed -E 's/\bchristos([eul]*)\b/Christos\1/gi')

libreoffice_output="$dir_path/${filename}.pptx"
pptx_file="$dir_path/${normalized_filename}.pptx"

# Check if normalized .pptx already exists
if [ -f "$pptx_file" ]; then
    rm -f "$ppt_file" 2>/dev/null || true
    exit 0
fi

# Ensure directory is writable
chmod u+w "$dir_path" 2>/dev/null || true

# Convert using LibreOffice with isolated user profile
worker_profile="$profile_dir/worker-$worker_id"
mkdir -p "$worker_profile"

timeout 120 soffice \
    --headless \
    "-env:UserInstallation=file://$worker_profile" \
    --convert-to pptx \
    --outdir "$dir_path" \
    "$ppt_file" 2>/dev/null || true

# Check result
if [ -f "$libreoffice_output" ]; then
    if [ "$libreoffice_output" != "$pptx_file" ]; then
        mv "$libreoffice_output" "$pptx_file" 2>/dev/null || true
    fi
    rm -f "$ppt_file" 2>/dev/null || true
    echo "[OK] $normalized_filename.pptx"
else
    echo "[FAIL] $original_filename"
fi
WORKER_EOF
chmod +x "$WORKER_SCRIPT"

# Check if GNU parallel is available
if command -v parallel &> /dev/null; then
    echo "Using GNU parallel for concurrent processing..."
    echo ""

    # Use GNU parallel with job slots (disable progress bar for non-tty)
    parallel --jobs "$WORKERS" \
        "$WORKER_SCRIPT" {} {%} "$PROFILE_DIR" \
        :::: "$FILE_LIST"
else
    echo "GNU parallel not found, using xargs for concurrent processing..."
    echo "(Install with: brew install parallel)"
    echo ""

    # Run with xargs
    cat "$FILE_LIST" | xargs -P "$WORKERS" -I {} "$WORKER_SCRIPT" {} "$$" "$PROFILE_DIR"
fi

# Count results
echo ""
echo "========================================="
echo "Conversion complete!"
echo "========================================="

remaining=$(find "$SOURCE_DIR" -iname "*.ppt" -type f 2>/dev/null | wc -l | tr -d ' ')
converted=$(find "$SOURCE_DIR" -iname "*.pptx" -type f 2>/dev/null | wc -l | tr -d ' ')

echo "Original PPT files: $total"
echo "Remaining PPT files: $remaining"
echo "PPTX files now: $converted"
echo "Processed: $((total - remaining))"
