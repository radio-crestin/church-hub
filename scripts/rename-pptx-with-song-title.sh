#!/bin/bash

# Rename PPTX files to include song title from first slide
# Format: (current_filename) - (song_title).pptx
# Usage: ./rename-pptx-with-song-title.sh [directory]

SOURCE_DIR="${1:-/Users/iosif/Downloads/Cantari PDC pptx/}"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory does not exist: $SOURCE_DIR"
    exit 1
fi

# Function to extract song title (first non-empty text line from first slide)
extract_song_title() {
    local pptx_file="$1"

    # Extract slide1.xml content and parse for text
    # PPTX files are ZIP archives, slide content is in ppt/slides/slide1.xml
    # Text is contained in <a:t> tags
    local title
    title=$(unzip -p "$pptx_file" "ppt/slides/slide1.xml" 2>/dev/null | \
        grep -oE '<a:t>[^<]+</a:t>' | \
        sed 's/<a:t>//g; s/<\/a:t>//g' | \
        grep -v '^[[:space:]]*$' | \
        head -1 | \
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    echo "$title"
}

# Function to sanitize filename (keep only alphanumeric and hyphens)
sanitize_filename() {
    local name="$1"
    # Keep only alphanumeric characters (a-zA-Z0-9), hyphens (-), and spaces
    # Remove all special characters like commas, periods, quotes, etc.
    name=$(echo "$name" | sed 's/[^a-zA-Z0-9 -]//g')
    # Replace multiple spaces with single space
    name=$(echo "$name" | sed 's/  */ /g')
    # Replace multiple hyphens with single hyphen
    name=$(echo "$name" | sed 's/--*/-/g')
    # Remove leading/trailing spaces and hyphens
    name=$(echo "$name" | sed 's/^[[:space:]-]*//; s/[[:space:]-]*$//')
    # Trim to reasonable length (max 100 chars for title part)
    name="${name:0:100}"
    echo "$name"
}

renamed=0
skipped=0
failed=0

echo "Processing PPTX files in: $SOURCE_DIR"
echo ""

# Process all .pptx files
find "$SOURCE_DIR" -maxdepth 1 -iname "*.pptx" -type f | sort | while read -r file; do
    original_filename=$(basename "$file")
    dir_path=$(dirname "$file")

    # Get base name without extension
    base_name="${original_filename%.pptx}"
    base_name="${base_name%.PPTX}"

    # Skip files that already have " - " in the name (likely already processed)
    if [[ "$original_filename" == *" - "* ]]; then
        echo "Skipping (already has title): $original_filename"
        ((skipped++))
        continue
    fi

    # Extract song title from first slide
    song_title=$(extract_song_title "$file")

    if [ -z "$song_title" ]; then
        echo "Warning: Could not extract title from: $original_filename"
        ((failed++))
        continue
    fi

    # Sanitize the song title for use in filename
    safe_title=$(sanitize_filename "$song_title")

    if [ -z "$safe_title" ]; then
        echo "Warning: Empty title after sanitization for: $original_filename"
        ((failed++))
        continue
    fi

    # Create new filename: (current_filename) - (song_title).pptx
    new_filename="${base_name} - ${safe_title}.pptx"
    new_path="$dir_path/$new_filename"

    # Check if target already exists
    if [ -f "$new_path" ]; then
        echo "Skipping (target exists): $original_filename -> $new_filename"
        ((skipped++))
        continue
    fi

    # Rename the file
    if mv "$file" "$new_path" 2>/dev/null; then
        echo "Renamed: $original_filename"
        echo "     -> $new_filename"
        ((renamed++))
    else
        echo "Error renaming: $original_filename"
        ((failed++))
    fi
done

echo ""
echo "========================================="
echo "Rename complete!"
echo "Renamed: $renamed files"
echo "Skipped: $skipped files"
echo "Failed:  $failed files"
echo "========================================="
