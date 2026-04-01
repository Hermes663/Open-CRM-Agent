import "server-only";

import { Pool } from "pg";

import type {
  Activity,
  AgentRun,
  Contact,
  Deal,
  DealWithRelations,
  PipelineStage,
  PipelineSummary,
  SettingsStatus,
} from "@/lib/types";

type SqlRow = Record<string, unknown>;

const globalForDb = globalThis as typeof globalThis & {
  __autosalesPool?: Pool;
};

function databaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (direct) {
    return direct;
  }

  const password = process.env.DB_PASSWORD ?? "change_me_in_production";
  const host = process.env.DB_HOST ?? "localhost";
  const port = process.env.DB_PORT ?? "5432";
  const database = process.env.DB_NAME ?? "autosales";
  const user = process.env.DB_USER ?? "autosales";
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function getPool(): Pool {
  if (!globalForDb.__autosalesPool) {
    globalForDb.__autosalesPool = new Pool({
      connectionString: databaseUrl(),
    });
  }
  return globalForDb.__autosalesPool;
}

async function query<T extends SqlRow = SqlRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

async function queryOne<T extends SqlRow = SqlRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function toNullableIso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return toIso(value);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeAgentName(value: unknown, metadata?: Record<string, unknown> | null): string | null {
  const candidate = String(metadata?.agent_name ?? value ?? "").trim();
  if (!candidate) {
    return null;
  }
  const lowered = candidate.toLowerCase();
  if (lowered.includes("orchestrator")) return "orchestrator";
  if (lowered.includes("research")) return "research";
  if (lowered.includes("qualifier")) return "qualifier";
  if (lowered.includes("follow")) return "followup";
  if (lowered.includes("human")) return "human";
  return lowered;
}

function defaultActivityDescription(activityType: string): string {
  const labels: Record<string, string> = {
    email_sent: "Outbound email",
    email_received: "Inbound email",
    research_completed: "Research completed",
    stage_changed: "Stage changed",
    agent_decision: "Agent decision",
    follow_up_sent: "Follow-up sent",
    deal_created: "Deal created",
    deal_won: "Deal won",
    deal_lost: "Deal lost",
    note_added: "Note added",
    human_responded: "Human response",
    escalated_to_human: "Escalated to human",
    quote_sent: "Quote sent",
    quote_accepted: "Quote accepted",
    quote_rejected: "Quote rejected",
  };
  return labels[activityType] ?? activityType.replaceAll("_", " ");
}

function mapDeal(row: SqlRow): Deal {
  return {
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? (row.title as string | null) ?? "Untitled deal",
    contact_name: (row.contact_name as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    value: toNumber(row.value ?? row.value_eur ?? row.value_pln),
    value_pln: row.value_pln ? toNumber(row.value_pln) : undefined,
    stage: String(row.stage) as PipelineStage,
    priority_score: toNumber(row.priority_score ?? row.priority, 50),
    agent_name: normalizeAgentName(row.agent_name ?? row.assigned_agent),
    stage_entered_at: toIso(row.stage_entered_at ?? row.updated_at ?? row.created_at),
    expected_close_date: (row.expected_close_date as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    customer_id: (row.customer_id as string | null) ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    owner_id: (row.owner_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    currency: (row.currency as string | null) ?? "EUR",
    lost_reason: (row.lost_reason as string | null) ?? null,
  };
}

function mapContact(row: SqlRow): Contact {
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
    company_name: String(row.company_name ?? ""),
    email: String(row.email ?? ""),
    phone: (row.phone as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    research_summary: (row.research_summary as string | null) ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    deal_count: row.deal_count ? toNumber(row.deal_count) : undefined,
    last_contact: toNullableIso(row.last_contact),
  };
}

function mapActivity(row: SqlRow): Activity {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  const activityType = String(row.activity_type ?? "note_added");
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    activity_type: activityType,
    description:
      (row.subject as string | null) ??
      defaultActivityDescription(activityType),
    subject: (row.subject as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    metadata,
    agent_name: normalizeAgentName(row.created_by, metadata),
    created_by: (row.created_by as string | null) ?? null,
    created_at: toIso(row.created_at),
  };
}

function mapAgentRun(row: SqlRow): AgentRun {
  return {
    id: String(row.id),
    run_type: String(row.run_type),
    agent_name: normalizeAgentName(row.agent_name),
    status: String(row.status) as AgentRun["status"],
    input_summary: (row.input_summary as string | null) ?? null,
    output_summary: (row.output_summary as string | null) ?? null,
    duration_ms: row.duration_ms ? toNumber(row.duration_ms) : null,
    started_at: toIso(row.started_at),
    completed_at: toNullableIso(row.completed_at),
    error_message: (row.error_message as string | null) ?? null,
  };
}

export async function listDeals(stage?: string | null): Promise<Deal[]> {
  const params: unknown[] = [];
  let whereClause = "";
  if (stage) {
    params.push(stage);
    whereClause = "WHERE stage = $1";
  }

  const rows = await query(
    `
      SELECT *
      FROM deals
      ${whereClause}
      ORDER BY updated_at DESC
    `,
    params,
  );
  return rows.map(mapDeal);
}

export async function createDeal(input: Partial<Deal>): Promise<Deal> {
  const row = await queryOne(
    `
      INSERT INTO deals (
        title,
        company_name,
        contact_name,
        contact_email,
        value,
        value_eur,
        value_pln,
        stage,
        priority_score,
        priority,
        agent_name,
        assigned_agent,
        stage_entered_at,
        owner_id,
        notes,
        customer_id,
        tags,
        currency,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $5, $5, $6, $7, $7, $8, $8, NOW(), $9, $10, $11, $12, $13, NOW(), NOW()
      )
      RETURNING *
    `,
    [
      input.title ?? input.company_name ?? "Untitled deal",
      input.company_name ?? "Untitled deal",
      input.contact_name ?? null,
      input.contact_email ?? null,
      input.value ?? 0,
      input.stage ?? "new_deal",
      input.priority_score ?? 50,
      input.agent_name ?? "research",
      input.owner_id ?? null,
      input.notes ?? null,
      input.customer_id ?? null,
      input.tags ?? [],
      input.currency ?? "EUR",
    ],
  );

  if (!row) {
    throw new Error("Failed to create deal");
  }
  return mapDeal(row);
}

export async function getDealWithRelations(id: string): Promise<DealWithRelations | null> {
  const dealRow = await queryOne("SELECT * FROM deals WHERE id = $1 LIMIT 1", [id]);
  if (!dealRow) {
    return null;
  }

  const deal = mapDeal(dealRow);
  const [customer, activities] = await Promise.all([
    deal.customer_id ? getContactById(deal.customer_id) : Promise.resolve(null),
    listActivitiesForDeal(id),
  ]);

  return {
    ...deal,
    customer,
    activities,
  };
}

export async function updateDeal(
  id: string,
  input: Partial<Deal>,
): Promise<Deal | null> {
  const payload = { ...input };
  const assignments: string[] = [];
  const params: unknown[] = [];

  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  entries.forEach(([key, value], index) => {
    assignments.push(`${key} = $${index + 1}`);
    params.push(value);
  });

  assignments.push(`updated_at = NOW()`);
  if (payload.stage) {
    assignments.push(`stage_entered_at = NOW()`);
  }

  params.push(id);
  const row = await queryOne(
    `
      UPDATE deals
      SET ${assignments.join(", ")}
      WHERE id = $${params.length}
      RETURNING *
    `,
    params,
  );

  return row ? mapDeal(row) : null;
}

export async function listActivitiesForDeal(dealId: string): Promise<Activity[]> {
  const rows = await query(
    `
      SELECT *
      FROM activities
      WHERE deal_id = $1
      ORDER BY created_at DESC
    `,
    [dealId],
  );
  return rows.map(mapActivity);
}

export async function createActivityForDeal(
  dealId: string,
  input: {
    activity_type: string;
    description?: string | null;
    body?: string | null;
    metadata?: Record<string, unknown>;
    agent_name?: string | null;
    created_by?: string | null;
  },
): Promise<Activity> {
  const row = await queryOne(
    `
      INSERT INTO activities (
        deal_id,
        customer_id,
        activity_type,
        subject,
        body,
        metadata,
        created_by
      )
      VALUES (
        $1,
        (SELECT customer_id FROM deals WHERE id = $1),
        $2,
        $3,
        $4,
        $5,
        $6
      )
      RETURNING *
    `,
    [
      dealId,
      input.activity_type,
      input.description ?? null,
      input.body ?? null,
      input.metadata ?? {},
      input.created_by ?? input.agent_name ?? "web",
    ],
  );

  if (!row) {
    throw new Error("Failed to create activity");
  }
  return mapActivity(row);
}

export async function listContacts(limit = 500): Promise<Contact[]> {
  const rows = await query(
    `
      SELECT
        p.customer_id AS id,
        CONCAT_WS(' ', p.first_name, p.surname) AS full_name,
        p.company_name,
        p.email,
        p.phone,
        p.country,
        p.language,
        p.company_research AS research_summary,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT d.id)::int AS deal_count,
        MAX(a.created_at) AS last_contact
      FROM prospects_data p
      LEFT JOIN deals d ON d.customer_id = p.customer_id
      LEFT JOIN activities a ON a.deal_id = d.id
      GROUP BY p.customer_id, p.first_name, p.surname, p.company_name, p.email,
               p.phone, p.country, p.language, p.company_research, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return rows.map(mapContact);
}

export async function getContactById(id: string): Promise<Contact | null> {
  const row = await queryOne(
    `
      SELECT
        p.customer_id AS id,
        CONCAT_WS(' ', p.first_name, p.surname) AS full_name,
        p.company_name,
        p.email,
        p.phone,
        p.country,
        p.language,
        p.company_research AS research_summary,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT d.id)::int AS deal_count,
        MAX(a.created_at) AS last_contact
      FROM prospects_data p
      LEFT JOIN deals d ON d.customer_id = p.customer_id
      LEFT JOIN activities a ON a.deal_id = d.id
      WHERE p.customer_id = $1
      GROUP BY p.customer_id, p.first_name, p.surname, p.company_name, p.email,
               p.phone, p.country, p.language, p.company_research, p.created_at, p.updated_at
      LIMIT 1
    `,
    [id],
  );
  return row ? mapContact(row) : null;
}

export async function listDealsForContact(contactId: string): Promise<Deal[]> {
  const rows = await query(
    `
      SELECT *
      FROM deals
      WHERE customer_id = $1
      ORDER BY updated_at DESC
    `,
    [contactId],
  );
  return rows.map(mapDeal);
}

export async function listPipelineSummary(): Promise<PipelineSummary[]> {
  const rows = await query(
    `
      SELECT
        stage,
        COUNT(*)::int AS count,
        COALESCE(SUM(COALESCE(value, value_eur, value_pln, 0)), 0) AS total_value
      FROM deals
      GROUP BY stage
      ORDER BY stage
    `,
  );

  return rows.map((row) => ({
    stage: String(row.stage) as PipelineStage,
    count: toNumber(row.count),
    total_value: toNumber(row.total_value),
  }));
}

export async function listAgentRuns(limit = 20): Promise<AgentRun[]> {
  const rows = await query(
    `
      SELECT *
      FROM agent_runs
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return rows.map(mapAgentRun);
}

export async function getSettingsStatus(): Promise<SettingsStatus> {
  const emailProvider = process.env.EMAIL_PROVIDER?.trim() || null;
  const llmProvider =
    process.env.LLM_PROVIDER?.trim() ||
    process.env.DEFAULT_LLM_PROVIDER?.trim() ||
    null;

  const emailConfigured = (() => {
    if (!emailProvider) return false;
    if (emailProvider === "gmail") {
      return Boolean(
        process.env.GMAIL_CLIENT_ID &&
          process.env.GMAIL_CLIENT_SECRET &&
          process.env.GMAIL_REFRESH_TOKEN,
      );
    }
    if (emailProvider === "outlook") {
      return Boolean(
        process.env.OUTLOOK_CLIENT_ID &&
          process.env.OUTLOOK_CLIENT_SECRET &&
          process.env.OUTLOOK_TENANT_ID &&
          process.env.OUTLOOK_USER_EMAIL,
      );
    }
    if (emailProvider === "imap") {
      return Boolean(
        process.env.IMAP_HOST &&
          process.env.IMAP_USER &&
          process.env.IMAP_PASSWORD &&
          process.env.SMTP_HOST,
      );
    }
    return false;
  })();

  const llmConfigured = (() => {
    if (!llmProvider) return false;
    if (llmProvider === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (llmProvider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
    if (llmProvider === "openai-codex") {
      return Boolean(
        process.env.OPENAI_API_KEY ||
          process.env.OPENAI_CODEX_CLIENT_ID ||
          process.env.CODEX_OAUTH_CLIENT_ID,
      );
    }
    return false;
  })();

  return {
    database_configured: Boolean(process.env.DATABASE_URL),
    heartbeat_interval_minutes: Number(process.env.HEARTBEAT_INTERVAL_MINUTES ?? "30"),
    email_provider: emailProvider,
    email_configured: emailConfigured,
    llm_provider: llmProvider,
    llm_configured: llmConfigured,
  };
}
