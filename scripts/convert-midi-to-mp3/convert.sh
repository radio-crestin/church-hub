#!/bin/bash

# MIDI to MP3 Converter
# Uses FluidSynth with high-quality soundfonts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOUNDFONT_DIR="$SCRIPT_DIR/soundfonts"
SOUNDFONT_PATH="$SOUNDFONT_DIR/FluidR3_GM.sf2"

# Default values
INPUT_DIR="${1:-/Users/iosif/Downloads/All}"
OUTPUT_DIR="${2:-$INPUT_DIR/mp3}"
SAMPLE_RATE="${3:-44100}"
BITRATE="${4:-320k}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v fluidsynth &> /dev/null; then
        log_error "FluidSynth not found. Install with: brew install fluid-synth"
        exit 1
    fi

    if ! command -v ffmpeg &> /dev/null; then
        log_error "FFmpeg not found. Install with: brew install ffmpeg"
        exit 1
    fi

    log_success "All dependencies found"
}

download_soundfont() {
    if [[ -f "$SOUNDFONT_PATH" ]]; then
        log_info "Soundfont already exists: $SOUNDFONT_PATH"
        return
    fi

    log_info "Downloading FluidR3 GM soundfont (141MB)..."
    mkdir -p "$SOUNDFONT_DIR"

    # FluidR3 GM - High quality General MIDI soundfont (from SourceForge)
    SOUNDFONT_URL="https://sourceforge.net/projects/androidframe/files/soundfonts/FluidR3_GM.sf2/download"

    if command -v curl &> /dev/null; then
        curl -L -o "$SOUNDFONT_PATH" "$SOUNDFONT_URL" --progress-bar
    elif command -v wget &> /dev/null; then
        wget -O "$SOUNDFONT_PATH" "$SOUNDFONT_URL" --show-progress
    else
        log_error "Neither curl nor wget found. Please install one."
        exit 1
    fi

    log_success "Soundfont downloaded: $SOUNDFONT_PATH"
}

convert_midi_to_mp3() {
    local midi_file="$1"
    local filename=$(basename "$midi_file")
    local name_without_ext="${filename%.*}"
    local output_file="$OUTPUT_DIR/${name_without_ext}.mp3"
    local temp_wav="/tmp/${name_without_ext}_$$.wav"

    if [[ -f "$output_file" ]]; then
        log_warn "Skipping (already exists): $output_file"
        return 0
    fi

    log_info "Converting: $filename"

    # Step 1: MIDI to WAV using FluidSynth
    # Syntax: fluidsynth [options] soundfont midifile
    fluidsynth -n -i -r "$SAMPLE_RATE" -F "$temp_wav" "$SOUNDFONT_PATH" "$midi_file" 2>/dev/null

    # Step 2: WAV to MP3 using FFmpeg with high quality settings
    ffmpeg -i "$temp_wav" \
        -codec:a libmp3lame \
        -b:a "$BITRATE" \
        -q:a 0 \
        -y \
        "$output_file" 2>/dev/null

    # Cleanup temp file
    rm -f "$temp_wav"

    log_success "Created: $output_file"
}

main() {
    echo ""
    echo "=================================="
    echo "   MIDI to MP3 Converter"
    echo "=================================="
    echo ""

    log_info "Input directory: $INPUT_DIR"
    log_info "Output directory: $OUTPUT_DIR"
    log_info "Sample rate: $SAMPLE_RATE Hz"
    log_info "Bitrate: $BITRATE"
    echo ""

    # Validate input directory
    if [[ ! -d "$INPUT_DIR" ]]; then
        log_error "Input directory does not exist: $INPUT_DIR"
        exit 1
    fi

    check_dependencies
    download_soundfont

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Find all MIDI files
    shopt -s nullglob nocaseglob
    midi_files=("$INPUT_DIR"/*.mid "$INPUT_DIR"/*.midi)
    shopt -u nullglob nocaseglob

    if [[ ${#midi_files[@]} -eq 0 ]]; then
        log_warn "No MIDI files found in: $INPUT_DIR"
        exit 0
    fi

    log_info "Found ${#midi_files[@]} MIDI file(s)"
    echo ""

    # Convert each file
    converted=0
    failed=0

    for midi_file in "${midi_files[@]}"; do
        if convert_midi_to_mp3 "$midi_file"; then
            ((converted++))
        else
            ((failed++))
            log_error "Failed to convert: $(basename "$midi_file")"
        fi
    done

    echo ""
    echo "=================================="
    log_success "Conversion complete!"
    log_info "Converted: $converted files"
    [[ $failed -gt 0 ]] && log_warn "Failed: $failed files"
    log_info "Output: $OUTPUT_DIR"
    echo "=================================="
}

main "$@"
