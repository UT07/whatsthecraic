#!/bin/bash
# Remove all secrets from markdown files

echo "Removing secrets from repository..."

# Define replacements
declare -A replacements=(
    ["REDACTED_GITHUB_PAT"]="<REDACTED_GITHUB_PAT>"
    ["REDACTED_DB_USER"]="<REDACTED_DB_USER>"
    ["REDACTED_DB_PASSWORD"]="<REDACTED_DB_PASSWORD>"
    ["REDACTED_DB_HOST"]="<REDACTED_DB_HOST>"
    ["REDACTED_JWT_SECRET"]="<REDACTED_JWT_SECRET>"
)

# Find all markdown files and replace secrets
for file in $(find . -name "*.md" -type f | grep -v node_modules | grep -v .git); do
    if grep -qE "ghp_|REDACTED_DB_USER|wtcRds|172\.31\.30\.66|wtc-prod-secret" "$file" 2>/dev/null; then
        echo "Processing: $file"
        for secret in "${!replacements[@]}"; do
            replacement="${replacements[$secret]}"
            sed -i.bak "s/$secret/$replacement/g" "$file"
        done
        rm -f "$file.bak"
    fi
done

echo "Secrets removed from current files"
