"""Helpers for resolving project-relative paths in local and Docker runtime."""

from __future__ import annotations

import os
from pathlib import Path


def project_root() -> Path:
    """Return the repository root based on the current module path."""
    return Path(__file__).resolve().parents[4]


def resolve_project_path(path_like: str | Path) -> Path:
    """Resolve *path_like* relative to the repository root when needed."""
    path = Path(path_like)
    if path.is_absolute():
        return path
    return project_root() / path


def agent_config_dir() -> Path:
    """Return the configured agent-config directory."""
    configured = os.environ.get("AGENT_CONFIG_DIR")
    if configured:
        return resolve_project_path(configured)
    return project_root() / "agent-config"
