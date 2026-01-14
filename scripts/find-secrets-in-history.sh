#!/bin/bash

# Script to find secrets in git history
# Searches for accidentally committed secrets, API keys, tokens, and sensitive files

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "  Secrets Scanner for Git History"
echo -e "==========================================${NC}"

FOUND_SECRETS=0
CRITICAL_SECRETS=0

echo -e "\n${YELLOW}[1] Searching for sensitive files ever committed...${NC}"

SENSITIVE_FILES=(
    "*.env"
    ".env"
    ".env.local"
    ".env.development"
    ".env.production"
    ".dev.vars"
    ".prod.vars"
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "id_rsa"
    "id_dsa"
    "id_ecdsa"
    "id_ed25519"
    "*.db"
    "*.sqlite"
    "*.sqlite3"
    "credentials.json"
    "secrets.json"
    ".htpasswd"
    ".npmrc"
    ".pypirc"
)

for pattern in "${SENSITIVE_FILES[@]}"; do
    files=$(git log --all --full-history --diff-filter=A --name-only --pretty=format:"" -- "$pattern" 2>/dev/null | sort -u | grep -v '^$' | grep -v '\.sample' | grep -v '\.example' || true)
    if [[ -n "$files" ]]; then
        echo -e "${RED}[FOUND]${NC} Sensitive file pattern: $pattern"
        echo "$files" | sed 's/^/        /'
        FOUND_SECRETS=1
    fi
done

echo -e "\n${YELLOW}[2] Searching for OpenAI API keys...${NC}"

openai_keys=$(git log -p --all 2>/dev/null | grep -oE 'sk-proj-[a-zA-Z0-9_-]{20,}' | sort -u || true)
if [[ -n "$openai_keys" ]]; then
    echo -e "${RED}[CRITICAL]${NC} OpenAI API Keys found in history!"
    echo "$openai_keys" | while read key; do
        echo -e "        ${RED}$key${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

openai_keys_old=$(git log -p --all 2>/dev/null | grep -oE 'sk-[a-zA-Z0-9]{32,}' | grep -v 'sk-proj' | sort -u || true)
if [[ -n "$openai_keys_old" ]]; then
    echo -e "${RED}[CRITICAL]${NC} OpenAI API Keys (old format) found!"
    echo "$openai_keys_old" | while read key; do
        echo -e "        ${RED}$key${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[3] Searching for GitHub tokens...${NC}"

github_pats=$(git log -p --all 2>/dev/null | grep -oE 'github_pat_[0-9a-zA-Z_]{36,}' | sort -u || true)
if [[ -n "$github_pats" ]]; then
    echo -e "${RED}[CRITICAL]${NC} GitHub Personal Access Tokens found!"
    echo "$github_pats" | while read token; do
        echo -e "        ${RED}$token${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

ghp_tokens=$(git log -p --all 2>/dev/null | grep -oE 'ghp_[a-zA-Z0-9]{36,}' | sort -u || true)
if [[ -n "$ghp_tokens" ]]; then
    echo -e "${RED}[CRITICAL]${NC} GitHub tokens (ghp_) found!"
    echo "$ghp_tokens" | while read token; do
        echo -e "        ${RED}$token${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[4] Searching for AWS credentials...${NC}"

aws_keys=$(git log -p --all 2>/dev/null | grep -oE 'AKIA[0-9A-Z]{16}' | sort -u || true)
if [[ -n "$aws_keys" ]]; then
    echo -e "${RED}[CRITICAL]${NC} AWS Access Key IDs found!"
    echo "$aws_keys" | while read key; do
        echo -e "        ${RED}$key${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[5] Searching for private keys...${NC}"

if git log -p --all 2>/dev/null | grep -q 'BEGIN.*PRIVATE KEY'; then
    echo -e "${RED}[CRITICAL]${NC} Private keys found in history!"
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[6] Searching for database URLs with credentials...${NC}"

db_urls=$(git log -p --all 2>/dev/null | grep -oE '(postgres|mysql|mongodb|redis)://[^[:space:]"]+:[^[:space:]"]+@[^[:space:]"]+' | sort -u || true)
if [[ -n "$db_urls" ]]; then
    echo -e "${RED}[CRITICAL]${NC} Database URLs with credentials found!"
    echo "$db_urls" | while read url; do
        echo -e "        ${RED}$url${NC}"
    done
    CRITICAL_SECRETS=1
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[7] Searching for Upstash/Redis tokens...${NC}"

upstash_tokens=$(git log -p --all 2>/dev/null | grep -oE 'UPSTASH_[A-Z_]+_TOKEN[=:][[:space:]]*"?[A-Za-z0-9+/=]{30,}' | sort -u || true)
if [[ -n "$upstash_tokens" ]]; then
    echo -e "${RED}[FOUND]${NC} Upstash tokens found!"
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[8] Searching for Google/YouTube OAuth secrets...${NC}"

# Look for actual secrets (not placeholders)
google_secrets=$(git log -p --all 2>/dev/null | grep -E 'CLIENT_SECRET[=:][[:space:]]*"?[A-Za-z0-9_-]{20,}' | grep -v 'your-' | grep -v 'placeholder' | head -5 || true)
if [[ -n "$google_secrets" ]]; then
    echo -e "${YELLOW}[WARN]${NC} Potential Google/OAuth secrets (verify manually):"
    echo "$google_secrets" | head -3 | sed 's/^/        /'
    FOUND_SECRETS=1
fi

echo -e "\n${YELLOW}[9] Checking .env files in branches...${NC}"

for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/ 2>/dev/null | head -10); do
    env_files=$(git ls-tree -r "$branch" --name-only 2>/dev/null | grep -E '\.env$|\.dev\.vars$|\.prod\.vars$' | grep -v '\.sample' | grep -v '\.example' || true)
    if [[ -n "$env_files" ]]; then
        echo -e "${RED}[FOUND]${NC} Real .env files in branch: $branch"
        echo "$env_files" | sed 's/^/        /'
        FOUND_SECRETS=1
    fi
done

echo -e "\n${YELLOW}[10] Finding commits that touched secrets...${NC}"

echo "Commits with 'secret' in message or diff:"
git log --all --oneline -S "apiKey" --diff-filter=AMD 2>/dev/null | head -10 | sed 's/^/        /' || true

echo -e "\n${BLUE}=========================================="
if [[ $CRITICAL_SECRETS -eq 1 ]]; then
    echo -e "${RED}  CRITICAL: REAL SECRETS FOUND!${NC}"
    echo -e "${RED}  These secrets are exposed in git history${NC}"
    echo -e "${YELLOW}  Actions required:${NC}"
    echo -e "${YELLOW}  1. Rotate/invalidate ALL exposed secrets${NC}"
    echo -e "${YELLOW}  2. Use BFG Repo-Cleaner to remove from history${NC}"
    echo -e "${YELLOW}  3. Force push to all remotes${NC}"
elif [[ $FOUND_SECRETS -eq 1 ]]; then
    echo -e "${YELLOW}  Potential secrets found - review manually${NC}"
else
    echo -e "${GREEN}  No secrets detected in git history${NC}"
fi
echo -e "${BLUE}==========================================${NC}"

exit $CRITICAL_SECRETS
