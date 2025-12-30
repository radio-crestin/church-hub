#!/bin/bash

# Revert PPTX filenames back to just the number
# Usage: ./revert-pptx-names.sh [directory]

SOURCE_DIR="${1:-/Users/iosif/Downloads/Cantari PDC pptx/}"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory does not exist: $SOURCE_DIR"
    exit 1
fi

echo "Reverting PPTX filenames in: $SOURCE_DIR"
echo ""

find "$SOURCE_DIR" -maxdepth 1 -iname "*.pptx" -type f | while read -r file; do
    original_filename=$(basename "$file")
    dir_path=$(dirname "$file")

    # Extract the number part (everything before " - ")
    if [[ "$original_filename" == *" - "* ]]; then
        base_number=$(echo "$original_filename" | sed 's/ - .*//')
        new_filename="${base_number}.pptx"
        new_path="$dir_path/$new_filename"

        if [ "$file" != "$new_path" ]; then
            mv "$file" "$new_path" 2>/dev/null && echo "Reverted: $original_filename -> $new_filename"
        fi
    fi
done

echo ""
echo "Revert complete!"
