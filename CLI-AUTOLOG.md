# CLI Auto-Logging Spec

## Overview

Wire Sacred Timeline CLI (`sacred-timeline` repo) to automatically log CIQ trust measurements alongside git captures. One command generates both ledgers.

## Current State

Today, git captures and CIQ measurements are separate:

```bash
# Git side (Sacred Timeline CLI)
sacred capture "Updated briefing document"

# Data side (manual)
dolt sql -q "INSERT INTO ciq_measurements ..."
```

The goal: eliminate the manual step.

## Design

### Core Principle

**Every agent interaction generates both a git commit AND a Dolt CIQ row.**

The CLI detects agent involvement and auto-generates the CIQ row. The human never has to think about two systems.

### Agent Detection

The CLI identifies agents by inspecting the git author:

```bash
git config user.name
# "Yoda" → agent
# "Suhit Anantula" → human
# "Suhit (via Claude Code)" → human_with_agent
```

Alternatively, explicit flags:

```bash
sacred capture "message" --agent yoda --model glm-5-turbo
```

### Decision Mapping

CIQ decisions are inferred from git behaviour:

| Git Behaviour | CIQ Decision |
|---|---|
| Commit created and kept | **Accept** (default) |
| Commit amended within 10 minutes | **Override** |
| Branch discarded (`sacred discard`) | **Reject** |
| No commit (files changed but not captured) | **Deferred** |

The 10-minute window for override detection is configurable. If a human amends a commit shortly after creation, it's counted as an override rather than a new accept.

### Trust Score Calculation

For auto-logged measurements, trust score is calculated from the rolling window:

```
trust_score = accept_count / total_interactions
```

For manual override (when the human wants to set a specific score):

```bash
sacred ciq --trust 0.92 --curve building
```

### Calibration Curve Detection

The curve is auto-detected from the last N measurements:

```python
if recent_scores[-3:] are all declining:
    curve = "declining"
elif recent_scores[-5:] variance < 0.05:
    curve = "flat" or "plateau" (depending on level)
elif recent_scores[-3:] are increasing:
    curve = "building"
elif avg_score > 0.85 and variance < 0.03:
    curve = "high"
```

## New CLI Commands

### `sacred ciq`

Log or query CIQ measurements.

```bash
# Log a measurement
sacred ciq --agent yoda --model glm-5-turbo \
  --accept 12 --override 1 --reject 0 \
  --trust 0.92 --curve building \
  --note "Briefing generation session"

# Query recent CIQ
sacred ciq --agent yoda --last 10

# Show trust progression
sacred ciq --progression yoda

# Compare agents
sacred ciq --compare yoda,claude-code,codex
```

### `sacred capture` (enhanced)

Existing command with auto-logging:

```bash
# Existing behaviour — git commit
sacred capture "Updated policy section"

# New: with auto CIQ (when agent detected)
sacred capture "Updated policy section"
# → git commit created
# → CIQ row inserted automatically (accept assumed)

# New: explicit agent flag
sacred capture "Updated policy section" --agent yoda --model glm-5-turbo

# New: with experiment linkage
sacred capture "Test new briefing template" --experiment exp-001 --propose
# → git commit on experiment branch
# → CIQ row linked to experiment
# → Proposal row created in governance table
```

### `sacred timeline` (enhanced)

Show git log with CIQ overlay:

```bash
# Existing: git log
sacred timeline

# New: with trust scores
sacred timeline --ciq

# New: CIQ-focused view
sacred timeline --trust yoda
```

## MCP Server Integration

The MCP server (`mcp-server.ts`) gets new tools:

### `ciq_log`

```json
{
  "name": "ciq_log",
  "description": "Log a CIQ trust measurement for an agent interaction",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_name": { "type": "string" },
      "agent_model": { "type": "string" },
      "accept_count": { "type": "number" },
      "override_count": { "type": "number", "default": 0 },
      "reject_count": { "type": "number", "default": 0 },
      "trust_score": { "type": "number" },
      "calibration_curve": { "type": "string", "enum": ["declining","flat","building","plateau","high"] },
      "notes": { "type": "string" },
      "experiment_id": { "type": "string" }
    }
  }
}
```

### `ciq_query`

```json
{
  "name": "ciq_query",
  "description": "Query CIQ trust measurements",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_name": { "type": "string" },
      "since": { "type": "string" },
      "limit": { "type": "number", "default": 10 }
    }
  }
}
```

### `trust_progression`

```json
{
  "name": "trust_progression",
  "description": "Show trust score progression over time for an agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agent_name": { "type": "string" }
    }
  }
}
```

## Implementation Phases

### Phase 1: Manual CIQ command (1–2 days)
- `sacred ciq` command for manual logging
- Direct Dolt SQL insert via child_process
- No auto-detection yet

### Phase 2: Auto-logging on capture (2–3 days)
- Agent detection from git config
- Auto CIQ insert on `sacred capture`
- Override detection (amend within window)
- Branch discard → reject

### Phase 3: MCP tools (1–2 days)
- `ciq_log`, `ciq_query`, `trust_progression` tools
- Any MCP-connected agent can log/query CIQ

### Phase 4: Timeline integration (1 day)
- `sacred timeline --ciq` overlay
- `sacred timeline --trust` focused view

## Configuration

```yaml
# ~/.sacred-timeline/config.yaml
ciq:
  enabled: true
  dolt_path: "/path/to/sacred-timeline-dolt"
  auto_log: true
  override_window_minutes: 10
  rolling_window: 10  # measurements for curve detection
```

## Edge Cases

- **No Dolt server running** — CIQ logging fails silently, git capture proceeds. Warning logged to stderr.
- **Concurrent agents** — Dolt handles concurrent inserts. No locking needed.
- **Human-only capture** — no CIQ row generated. Only agent interactions are measured.
- **Multiple agents in one session** — each CIQ row is per-agent. The `actions` table records the session.
