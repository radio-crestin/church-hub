#!/bin/sh
# Sourced by pre-commit and pre-push: stops the commit or push when gitleaks
# is missing, and says how to install it on this OS. Never skips silently.

if ! command -v gitleaks >/dev/null 2>&1; then
  {
    echo "gitleaks is not installed: it checks every commit and push for leaked secrets."
    case "$(uname -s 2>/dev/null)" in
      Darwin) echo "Install it:  brew install gitleaks" ;;
      Linux) echo "Install it:  sudo apt install gitleaks   (or a release binary: https://github.com/gitleaks/gitleaks/releases)" ;;
      MINGW* | MSYS* | CYGWIN*) echo "Install it:  winget install Gitleaks.Gitleaks   (or: scoop install gitleaks)" ;;
      *) echo "Install it from https://github.com/gitleaks/gitleaks/releases" ;;
    esac
    echo "Then run the git command again."
  } >&2
  exit 1
fi
