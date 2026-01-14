#!/bin/bash

# Script to find .db files in git history
# This searches for any .db files that were ever committed

echo "Searching for .db files in git history..."
echo "==========================================="

# Method 1: Find all .db files ever tracked in any commit
echo -e "\n[1] All .db files ever committed:"
git log --all --full-history --diff-filter=A --name-only --pretty=format:"%H %s" -- "*.db" 2>/dev/null | while read line; do
    if [[ $line =~ ^[a-f0-9]{40} ]]; then
        echo -e "\nCommit: $line"
    elif [[ -n "$line" ]]; then
        echo "  File: $line"
    fi
done

# Method 2: Search all objects in git for .db files
echo -e "\n\n[2] All .db files in git objects (including deleted):"
git rev-list --all --objects | while read hash path; do
    if [[ "$path" == *.db ]]; then
        size=$(git cat-file -s "$hash" 2>/dev/null)
        echo "  $path (object: ${hash:0:8}, size: ${size:-unknown} bytes)"
    fi
done

# Method 3: Check if any .db files exist in current HEAD
echo -e "\n\n[3] .db files in current HEAD:"
git ls-tree -r HEAD --name-only 2>/dev/null | grep '\.db$' || echo "  None found in current HEAD"

# Method 4: Check all branches for .db files
echo -e "\n\n[4] .db files across all branches:"
for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/ refs/remotes/ 2>/dev/null); do
    files=$(git ls-tree -r "$branch" --name-only 2>/dev/null | grep '\.db$')
    if [[ -n "$files" ]]; then
        echo "  Branch: $branch"
        echo "$files" | sed 's/^/    /'
    fi
done

echo -e "\n==========================================="
echo "Search complete."
