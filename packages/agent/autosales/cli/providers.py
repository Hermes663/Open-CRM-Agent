"""CLI commands for provider management.

Usage examples::

    autosales providers list
    autosales providers models
    autosales providers auth status
    autosales providers auth login --provider openai --api-key sk-...
    autosales providers auth login --provider openai-codex
    autosales providers auth logout --provider openai
"""

from __future__ import annotations

import asyncio
import webbrowser
from typing import Optional

import typer

app = typer.Typer(no_args_is_help=True)
auth_app = typer.Typer(no_args_is_help=True, help="Manage provider authentication.")
app.add_typer(auth_app, name="auth")


# ---------------------------------------------------------------------------
# providers list
# ---------------------------------------------------------------------------

@app.command("list")
def list_providers() -> None:
    """List all registered LLM providers."""
    from autosales.providers.registry import get_registry

    registry = get_registry()
    providers = registry.list_providers()

    if not providers:
        typer.echo("No providers registered.")
        raise typer.Exit()

    typer.echo(f"\n{'ID':<18} {'Label':<22} {'Auth':<10} {'Env vars'}")
    typer.echo("-" * 72)
    for p in providers:
        env = ", ".join(p.env_vars)
        marker = " *" if p.id == registry.default_provider_id else ""
        typer.echo(f"{p.id + marker:<18} {p.label:<22} {p.auth_type.value:<10} {env}")

    typer.echo(f"\n  * = default provider ({registry.default_provider_id})\n")


# ---------------------------------------------------------------------------
# providers models
# ---------------------------------------------------------------------------

@app.command("models")
def list_models(
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Filter by provider id"),
) -> None:
    """List available models across all providers."""
    from autosales.providers.router import ModelRouter

    router = ModelRouter()
    models = router.list_all_models()

    if provider:
        models = [m for m in models if m["provider_id"] == provider]

    if not models:
        typer.echo("No models found.")
        raise typer.Exit()

    typer.echo(
        f"\n{'Provider':<18} {'Model':<32} {'Context':<10} "
        f"{'In $/1M':<10} {'Out $/1M'}"
    )
    typer.echo("-" * 90)
    for m in models:
        typer.echo(
            f"{m['provider_id']:<18} {m['model_id']:<32} "
            f"{m['context_window']:<10,} "
            f"${m['cost_input_per_1m']:<9.2f} ${m['cost_output_per_1m']:.2f}"
        )
    typer.echo()


# ---------------------------------------------------------------------------
# providers auth status
# ---------------------------------------------------------------------------

@auth_app.command("status")
def auth_status() -> None:
    """Show authentication status for all providers."""
    from autosales.providers.auth_profiles import AuthProfileStore
    from autosales.providers.registry import get_registry

    registry = get_registry()
    store = AuthProfileStore()

    typer.echo(f"\n{'Provider':<18} {'Auth type':<12} {'Status':<14} {'Identity'}")
    typer.echo("-" * 70)

    for provider in registry.list_providers():
        cred = store.get_credential(provider.id)
        if cred is None:
            typer.echo(
                f"{provider.id:<18} {provider.auth_type.value:<12} "
                f"{'NOT SET':<14} -"
            )
            continue

        if cred.is_expired:
            status = "EXPIRED"
        else:
            status = "OK"

        identity = cred.email or cred.display_name or "(key)"
        if cred.api_key:
            identity = f"...{cred.api_key[-6:]}"

        typer.echo(
            f"{provider.id:<18} {cred.auth_type.value:<12} "
            f"{status:<14} {identity}"
        )

    typer.echo()


# ---------------------------------------------------------------------------
# providers auth login
# ---------------------------------------------------------------------------

@auth_app.command("login")
def auth_login(
    provider: str = typer.Option(..., "--provider", "-p", help="Provider id to authenticate."),
    api_key: Optional[str] = typer.Option(None, "--api-key", "-k", help="API key (for api_key providers)."),
) -> None:
    """Authenticate with a provider (API key or OAuth)."""
    from autosales.providers.auth_profiles import AuthProfileStore
    from autosales.providers.base import AuthCredential, AuthType
    from autosales.providers.registry import get_registry

    registry = get_registry()

    try:
        prov = registry.get_provider(provider)
    except KeyError as exc:
        typer.echo(f"Error: {exc}")
        raise typer.Exit(code=1)

    store = AuthProfileStore()

    # --- API-key auth ---
    if prov.auth_type == AuthType.API_KEY:
        key = api_key or typer.prompt("Enter API key", hide_input=True)
        cred = AuthCredential(
            provider_id=prov.id,
            auth_type=AuthType.API_KEY,
            api_key=key,
        )
        # Validate
        typer.echo(f"Validating key with {prov.label}...")
        ok = asyncio.run(prov.authenticate(cred))
        if ok:
            store.save_credential(cred)
            typer.echo(f"Authenticated with {prov.label} successfully.")
        else:
            typer.echo("Authentication failed.", err=True)
            raise typer.Exit(code=1)
        return

    # --- OAuth auth (Codex) ---
    if prov.auth_type == AuthType.OAUTH:
        from autosales.providers.openai_codex_provider import OpenAICodexProvider

        if not isinstance(prov, OpenAICodexProvider):
            typer.echo(f"OAuth not implemented for {prov.id}", err=True)
            raise typer.Exit(code=1)

        url, state = prov.build_authorization_url()
        typer.echo(f"\nOpening browser for {prov.label} login...\n")
        typer.echo(f"If the browser doesn't open, visit:\n  {url}\n")
        webbrowser.open(url)

        code = typer.prompt("Paste the authorization code from the callback")
        typer.echo("Exchanging code for tokens...")

        try:
            cred = asyncio.run(prov.exchange_code(code))
            store.save_credential(cred)
            identity = cred.email or cred.display_name or "unknown"
            typer.echo(f"Authenticated as {identity} via {prov.label}.")
        except Exception as exc:
            typer.echo(f"Token exchange failed: {exc}", err=True)
            raise typer.Exit(code=1)
        return

    typer.echo(f"Unsupported auth type: {prov.auth_type.value}", err=True)
    raise typer.Exit(code=1)


# ---------------------------------------------------------------------------
# providers auth logout
# ---------------------------------------------------------------------------

@auth_app.command("logout")
def auth_logout(
    provider: str = typer.Option(..., "--provider", "-p", help="Provider id to remove credentials for."),
) -> None:
    """Remove stored credentials for a provider."""
    from autosales.providers.auth_profiles import AuthProfileStore

    store = AuthProfileStore()
    store.delete_credential(provider)
    typer.echo(f"Credentials for '{provider}' removed.")
