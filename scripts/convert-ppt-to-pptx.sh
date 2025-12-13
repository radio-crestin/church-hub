#!/bin/bash

# Convert all .ppt files to .pptx using LibreOffice
# Usage: ./convert-ppt-to-pptx.sh [directory]
# Default directory: /Users/iosif/Downloads/Cantari power point/

SOURCE_DIR="${1:-/Users/iosif/Downloads/Cantari power point/}"

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

# Function to normalize filename:
# - Convert to lowercase
# - Capitalize first letter
# - Keep special words capitalized: Isus, Hristos, Cristos, Dumnezeu
normalize_filename() {
    local name="$1"
    # Convert to lowercase
    name=$(echo "$name" | tr '[:upper:]' '[:lower:]')
    # Capitalize first letter
    name="$(echo "${name:0:1}" | tr '[:lower:]' '[:upper:]')${name:1}"
    # Capitalize special words and their forms (case-insensitive replacement)
    # Match word forms: isus, isuse, isusul, isusului, etc.
    name=$(echo "$name" | sed -E 's/\bisus([eul]*)\b/Isus\1/gi')
    name=$(echo "$name" | sed -E 's/\bhristos([eul]*)\b/Hristos\1/gi')
    name=$(echo "$name" | sed -E 's/\bcristos([eul]*)\b/Cristos\1/gi')
    name=$(echo "$name" | sed -E 's/\bdumnezeu([lui]*)\b/Dumnezeu\1/gi')
    # Also match christos (alternative spelling)
    name=$(echo "$name" | sed -E 's/\bchristos([eul]*)\b/Christos\1/gi')
    echo "$name"
}

# Count total .ppt files (including subdirectories, case-insensitive)
total=$(find "$SOURCE_DIR" -iname "*.ppt" -type f | wc -l | tr -d ' ')
echo "Found $total .ppt/.PPT files to convert in: $SOURCE_DIR (including subdirectories)"

if [ "$total" -eq 0 ]; then
    echo "No .ppt files found"
    exit 0
fi

converted=0
skipped=0
failed=0

# Process each .ppt file (including subdirectories, case-insensitive)
find "$SOURCE_DIR" -iname "*.ppt" -type f | while read -r ppt_file; do
    dir_path=$(dirname "$ppt_file")
    # Get filename without extension (handle both .ppt and .PPT)
    original_filename=$(basename "$ppt_file")
    filename="${original_filename%.[pP][pP][tT]}"

    # Normalize the filename (lowercase + special words capitalized + first letter uppercase)
    normalized_filename=$(normalize_filename "$filename")

    # LibreOffice creates the output with the original filename (just different extension)
    libreoffice_output="$dir_path/${filename}.pptx"
    # Our desired final filename
    pptx_file="$dir_path/${normalized_filename}.pptx"

    # Check if normalized .pptx already exists
    if [ -f "$pptx_file" ]; then
        echo "Removing (pptx exists): $ppt_file"
        rm "$ppt_file"
        ((skipped++))
        continue
    fi

    echo "Converting: $ppt_file"

    # Convert using LibreOffice (output to same directory as source)
    soffice --headless --convert-to pptx --outdir "$dir_path" "$ppt_file" 2>/dev/null

    # LibreOffice creates file with original name, we need to rename it
    if [ -f "$libreoffice_output" ]; then
        # Rename to normalized filename if different
        if [ "$libreoffice_output" != "$pptx_file" ]; then
            mv "$libreoffice_output" "$pptx_file"
            echo "  Success: $pptx_file (renamed from $filename.pptx)"
        else
            echo "  Success: $pptx_file"
        fi
        rm "$ppt_file"
        echo "  Removed: $ppt_file"
        ((converted++))
    else
        echo "  Failed: $ppt_file (keeping original)"
        ((failed++))
    fi
done

echo ""
echo "Conversion complete!"
echo "Total files: $total"
