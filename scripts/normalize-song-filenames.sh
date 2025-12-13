#!/bin/bash

# Normalize song filenames
# - Convert to lowercase
# - Capitalize first letter
# - Keep special words capitalized: Isus, Hristos, Cristos, Dumnezeu
# Usage: ./normalize-song-filenames.sh [directory]

SOURCE_DIR="${1:-/Users/iosif/Downloads/Cantari power point/}"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory does not exist: $SOURCE_DIR"
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

renamed=0
skipped=0

# Process all .pptx and .ppt files
find "$SOURCE_DIR" \( -iname "*.pptx" -o -iname "*.ppt" \) -type f | while read -r file; do
    dir_path=$(dirname "$file")
    original_filename=$(basename "$file")

    # Get extension (preserving case for matching)
    if [[ "$original_filename" =~ \.[pP][pP][tT][xX]$ ]]; then
        ext="pptx"
        name="${original_filename%.[pP][pP][tT][xX]}"
    else
        ext="ppt"
        name="${original_filename%.[pP][pP][tT]}"
    fi

    # Normalize the filename
    normalized_name=$(normalize_filename "$name")
    new_filename="${normalized_name}.${ext}"

    # Check if rename is needed (case-sensitive comparison)
    if [ "$original_filename" != "$new_filename" ]; then
        new_path="$dir_path/$new_filename"

        # On macOS (case-insensitive filesystem), we need a two-step rename
        # to change only the case of characters
        temp_path="$dir_path/.tmp_rename_$$_$(date +%s%N)"
        mv "$file" "$temp_path" && mv "$temp_path" "$new_path"

        if [ $? -eq 0 ]; then
            echo "Renamed: $original_filename -> $new_filename"
            ((renamed++))
        else
            echo "Failed: $original_filename"
            ((skipped++))
        fi
    fi
done

echo ""
echo "Rename complete!"
echo "Renamed: $renamed files"
echo "Skipped: $skipped files"
