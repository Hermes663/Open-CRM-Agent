"""FastAPI application -- the HTTP entry point for the AutoSales agent backend."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from autosales.channels.factory import build_email_channel
from autosales.core.agent_runner import AgentRunner
from autosales.core.heartbeat import HeartbeatDaemon
from autosales.integrations.supabase_client import SupabaseClient
from autosales.memory.manager import MemoryManager

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

logging.basicConfig(
    level=os.environ.get("AGENT_LOG_LEVEL", os.environ.get("LOG_LEVEL", "INFO")).upper(),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("autosales.main")

# ---------------------------------------------------------------------------
# Shared instances (initialised at startup)
# ---------------------------------------------------------------------------

db = SupabaseClient()
memory = MemoryManager(db=db)
runner = AgentRunner(db=db, memory=memory)
email_channel = build_email_channel()
runner.set_channel(email_channel)
heartbeat = HeartbeatDaemon(
    db=db,
    agent_runner=runner,
    interval_minutes=int(os.environ.get("HEARTBEAT_INTERVAL_MINUTES", "30")),
)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    logger.info("AutoSales agent backend starting up")
    heartbeat.start()
    yield
    heartbeat.stop()
    logger.info("AutoSales agent backend shut down")


app = FastAPI(
    title="AutoSales Agent API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class RunAgentRequest(BaseModel):
    deal_id: str
    extra_context: dict[str, Any] | None = None


class MemorySearchRequest(BaseModel):
    query: str
    customer_id: str | None = None


class EmailWebhookPayload(BaseModel):
    from_addr: str
    to_addr: str
    subject: str
    body: str
    message_id: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/agent/health")
async def health_check() -> dict[str, Any]:
    """Basic health check."""
    return {
        "status": "ok",
        "heartbeat_running": heartbeat.is_running,
        "email_provider_configured": email_channel is not None,
    }


@app.post("/agent/heartbeat")
async def trigger_heartbeat() -> dict[str, Any]:
    """Manually trigger one heartbeat cycle."""
    try:
        stats = await heartbeat.run_cycle()
        return {"status": "ok", "stats": stats}
    except Exception as exc:
        logger.exception("Heartbeat cycle failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agent/run/{agent_name}")
async def run_agent(agent_name: str, req: RunAgentRequest) -> dict[str, Any]:
    """Run a specific agent for a given deal."""
    deal = await db.get_deal(req.deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail=f"Deal {req.deal_id} not found")

    try:
        result = await runner.run(
            agent_name=agent_name,
            deal=deal,
            context=req.extra_context,
        )
        await db.create_agent_run(
            deal_id=req.deal_id,
            agent_name=agent_name,
            action_taken=result.action_taken,
            metadata={
                **result.metadata,
                "run_type": "manual",
                "output_summary": result.activity_log or result.action_taken,
            },
        )
        return {
            "status": "ok",
            "action_taken": result.action_taken,
            "stage_change": result.stage_change,
            "email_sent": result.email_sent,
            "activity_log": result.activity_log,
            "metadata": result.metadata,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Agent run failed: %s", agent_name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agent/memory/search")
async def search_memory(req: MemorySearchRequest) -> dict[str, Any]:
    """Semantic / full-text search across conversation memory."""
    results = await memory.search_conversations(
        query=req.query,
        customer_id=req.customer_id,
    )
    return {"status": "ok", "results": results}


@app.post("/webhooks/email")
async def email_webhook(payload: EmailWebhookPayload) -> dict[str, Any]:
    """Receive inbound email notifications (e.g. from a mail provider webhook).

    Stores the message as an inbound activity and triggers the orchestrator
    to decide whether an agent should act on it.
    """
    logger.info(
        "[webhook] Inbound email from %s to %s: %s",
        payload.from_addr,
        payload.to_addr,
        payload.subject,
    )

    # Try to find the deal associated with this sender
    # (simplified: search activities by from_addr)
    try:
        deal = await db.get_deal_by_contact_email(payload.from_addr)
        if not deal:
            logger.info("[webhook] No matching deal for sender %s", payload.from_addr)
            return {"status": "ok", "action": "no_matching_deal"}

        deal_id = deal.get("id", "")
        if not deal_id:
            return {"status": "ok", "action": "no_deal_id"}

        await db.create_activity(
            deal_id=deal_id,
            activity_type="email_received",
            subject=payload.subject,
            body=payload.body,
            metadata={
                "from": payload.from_addr,
                "message_id": payload.message_id,
            },
            created_by="email-webhook",
        )

        return {"status": "ok", "action": "activity_created", "deal_id": deal_id}
    except Exception as exc:
        logger.exception("[webhook] Failed to process inbound email")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
