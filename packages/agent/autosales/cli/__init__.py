"""AutoSales CLI entry-point.

Registers sub-command groups (providers, etc.) under a single ``typer`` app.
"""

from __future__ import annotations

import typer

from autosales.cli.providers import app as providers_app

app = typer.Typer(
    name="autosales",
    help="AutoSales AI -- autonomous sales agent CLI.",
    no_args_is_help=True,
)

app.add_typer(providers_app, name="providers", help="Manage LLM providers and auth.")


def main() -> None:
    """CLI entry-point (called from ``[project.scripts]``)."""
    app()
