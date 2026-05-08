# Sacred Timeline — Unified Dolt Schema

Three-layer data model: **Governance** (who did what) → **Trust** (was it good) → **Capability** (are we maturing).

## Design Principles

- **Soft foreign keys** — stores point at each other, no hard constraints
- **ai_involvement as ENUM everywhere** — governance baked into schema
- **JSONL resilience** — every table exportable to JSONL for git durability
- **Agent-first writes** — single-row inserts, no complex joins required

---

## Layer 1: Governance Ledger

Tracks *what happened and who approved it*.

### proposals

```sql
CREATE TABLE proposals (
    id              VARCHAR(64) PRIMARY KEY,        -- prop_...
    title           TEXT NOT NULL,
    rationale       TEXT,
    source_branch   VARCHAR(255) NOT NULL,
    target_branch   VARCHAR(255) NOT NULL DEFAULT 'main',
    status          ENUM('draft','open','approved','rejected','abandoned','merged') NOT NULL,

    -- Authorship
    author_type     ENUM('human','agent','human_with_agent') NOT NULL,
    author_id       VARCHAR(255) NOT NULL,
    human_owner     VARCHAR(255),

    -- AI provenance
    ai_involvement  ENUM('none','assisted','generated','autonomous') NOT NULL DEFAULT 'none',

    -- Review
    reviewer_id     VARCHAR(255),
    reviewer_type   ENUM('human','agent','human_with_agent'),
    review_decision ENUM('approved','rejected','changes_requested'),
    reviewer_note   TEXT,

    -- Git linkage
    capture_hash    VARCHAR(64),
    diff_summary    TEXT,
    files_changed   JSON,

    -- Provider mirror (GitHub PR, GitLab MR, Gitea PR)
    provider_type   VARCHAR(64),
    provider_ref    VARCHAR(255),

    -- Timestamps
    proposed_at     DATETIME NOT NULL,
    reviewed_at     DATETIME,
    resolved_at     DATETIME,
    created_at      DATETIME NOT NULL DEFAULT NOW(),
    updated_at      DATETIME NOT NULL DEFAULT NOW()
);
```

### actions

```sql
CREATE TABLE actions (
    id              VARCHAR(64) PRIMARY KEY,        -- act_...
    timestamp       DATETIME NOT NULL,

    -- Actor
    actor_type          ENUM('human','agent','human_with_agent') NOT NULL,
    actor_identity_source ENUM('mcp_client','env_var','git_author','manual') NOT NULL,
    actor_name          VARCHAR(255) NOT NULL,
    actor_session_id    VARCHAR(255),

    -- Surface and action
    tool_surface     ENUM('cli','web','mcp','api') NOT NULL,
    action           ENUM('capture','experiment','propose','review','resolve','export','draft','log','sync') NOT NULL,
    message          TEXT,

    -- Git linkage
    branch           VARCHAR(255),
    capture_hash     VARCHAR(64),
    files_changed    JSON,

    -- Governance linkage
    proposal_id      VARCHAR(255),
    export_id        VARCHAR(255),

    -- AI provenance
    ai_involvement   ENUM('none','assisted','generated','autonomous') NOT NULL DEFAULT 'none',
    policy_envelope  TEXT

    -- Timestamps
    created_at       DATETIME NOT NULL DEFAULT NOW(),
    updated_at       DATETIME NOT NULL DEFAULT NOW()
);
```

### exports

```sql
CREATE TABLE exports (
    id              VARCHAR(64) PRIMARY KEY,        -- exp_...
    proposal_id     VARCHAR(64) NOT NULL,
    source_commit   VARCHAR(64) NOT NULL,
    source_files    JSON NOT NULL,
    output_files    JSON NOT NULL,
    output_checksums JSON NOT NULL,
    export_format   VARCHAR(32),
    export_command  TEXT,

    -- Actor
    actor_id        VARCHAR(255) NOT NULL,
    actor_type      ENUM('human','agent','human_with_agent') NOT NULL,
    action_id       VARCHAR(64),

    exported_at     DATETIME NOT NULL DEFAULT NOW()
);
```

---

## Layer 2: Trust Ledger (CIQ)

Tracks *was the AI output actually trusted and useful*.

### ciq_measurements

```sql
CREATE TABLE ciq_measurements (
    measurement_id      VARCHAR(64) PRIMARY KEY,    -- ciq_...
    experiment_id       VARCHAR(255),
    team_id             VARCHAR(255),
    measured_at         DATETIME NOT NULL DEFAULT NOW(),

    -- Agent identity
    agent_name          VARCHAR(255),
    agent_model         VARCHAR(255),
    agent_session_id    VARCHAR(255),

    -- Interaction counts
    accept_count        INT DEFAULT 0,
    override_count      INT DEFAULT 0,
    reject_count        INT DEFAULT 0,
    total_interactions  INT DEFAULT 0,

    -- Computed
    accept_rate         DECIMAL(5,4) GENERATED ALWAYS AS (
        accept_count / NULLIF(total_interactions, 0)
    ) STORED,
    override_rate       DECIMAL(5,4) GENERATED ALWAYS AS (
        override_count / NULLIF(total_interactions, 0)
    ) STORED,

    -- Trust calibration
    trust_score         DECIMAL(5,4),
    trust_calibration_curve ENUM('declining','flat','building','plateau','high'),

    -- Context
    notes               TEXT,

    -- Governance linkage
    proposal_id         VARCHAR(255),
    action_id           VARCHAR(64)
);
```

### agent_actions

```sql
CREATE TABLE agent_actions (
    action_id           VARCHAR(64) PRIMARY KEY,    -- aga_...
    experiment_id       VARCHAR(255),
    agent_name          VARCHAR(255),
    agent_model         VARCHAR(255),

    -- What the agent did
    action_type         ENUM('generate','suggest','review','transform','execute','query') NOT NULL,
    input_summary       TEXT,
    output_summary      TEXT,

    -- Human decision
    human_decision      ENUM('accepted','overridden','rejected','deferred','no_response'),
    human_override_reason TEXT,

    -- Impact
    trust_impact        DECIMAL(3,2),
    quality_rating      ENUM('poor','adequate','good','excellent'),

    -- Governance linkage
    proposal_id         VARCHAR(255),
    ciq_measurement_id  VARCHAR(64),

    created_at          DATETIME NOT NULL DEFAULT NOW()
);
```

---

## Layer 3: Capability Ledger (AAA)

Tracks *is the team maturing*.

### aaa_assessments

```sql
CREATE TABLE aaa_assessments (
    assessment_id           VARCHAR(64) PRIMARY KEY,    -- aaa_...
    team_id                 VARCHAR(255),
    assessed_at             DATETIME NOT NULL DEFAULT NOW(),

    -- Assessor
    assessor                VARCHAR(255),
    assessor_type           ENUM('human','agent','human_with_agent') NOT NULL DEFAULT 'human',

    -- Maturity
    current_level           ENUM('Assist','Augment','Adapt') NOT NULL,
    previous_level          ENUM('Assist','Augment','Adapt'),

    -- Dimension scores (0.0 – 1.0)
    ai_literacy_score       DECIMAL(3,2),
    collaboration_maturity_score DECIMAL(3,2),
    governance_readiness_score    DECIMAL(3,2),
    tool_fluency_score      DECIMAL(3,2),

    -- Barriers and next steps
    top_level_barrier       TEXT,
    recommended_next_action TEXT,

    -- Evidence linkage
    based_on_ciq_ids        JSON,
    based_on_experiment_ids JSON
);
```

### teams

```sql
CREATE TABLE teams (
    team_id         VARCHAR(64) PRIMARY KEY,        -- team_...
    name            VARCHAR(255) NOT NULL,
    organisation    VARCHAR(255),
    description     TEXT,
    created_at      DATETIME NOT NULL DEFAULT NOW()
);
```

### experiments

```sql
CREATE TABLE experiments (
    experiment_id       VARCHAR(64) PRIMARY KEY,    -- exp_...
    team_id             VARCHAR(255),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    status              ENUM('planned','active','completed','abandoned') DEFAULT 'planned',

    started_at          DATETIME,
    completed_at        DATETIME,
    aaa_level_at_start  ENUM('Assist','Augment','Adapt'),
    aaa_level_at_end    ENUM('Assist','Augment','Adapt'),

    created_at          DATETIME NOT NULL DEFAULT NOW(),
    updated_at          DATETIME NOT NULL DEFAULT NOW()
);
```

---

## JSONL Resilience

After any write to Dolt, export to JSONL for git durability:

```bash
dolt sql -q "SELECT * FROM actions" --result-format jsonl > .sacred/actions.jsonl
dolt sql -q "SELECT * FROM proposals" --result-format jsonl > .sacred/proposals.jsonl
dolt sql -q "SELECT * FROM ciq_measurements" --result-format jsonl > .sacred/ciq.jsonl
dolt sql -q "SELECT * FROM aaa_assessments" --result-format jsonl > .sacred/aaa.jsonl
sacred capture "sync ledger exports to git"
```

---

## Day 1 vs Day 60

**Day 1 (internal):**
- actions, ciq_measurements, agent_actions
- Track Yoda + subagent interactions, build baseline

**Day 30 (proven):**
- proposals, experiments, teams
- Branch/merge workflow for experiments

**Day 60+ (UAE):**
- exports, aaa_assessments
- Full governance layer, export manifests, capability progression
