# Sacred Timeline — Local Connection Guide

How agents connect to the Sacred Timeline Dolt database on Mac Studio.

---

## Architecture

```
┌─────────────┐     MySQL wire protocol      ┌──────────────────┐
│   Yoda      │◄────────────────────────────►│  Dolt SQL Server │
│  (OpenClaw) │      127.0.0.1:3306          │  127.0.0.1:3306  │
└─────────────┘                               └──────────────────┘
       ▲                                              │
       │                                              │
┌──────┴──────┐     MySQL wire protocol               │
│  Subagents  │◄──────────────────────────────────────┘
│  (Codex,    │      127.0.0.1:3306
│   Gemini,   │
│   etc.)     │
└─────────────┘

┌─────────────┐     MCP / CLI               ┌──────────────────┐
│  Sacred     │◄────────────────────────────►│  Git repos       │
│  Timeline   │                              │  (code, docs)     │
│  CLI/MCP    │                              └──────────────────┘
└─────────────┘
```

Two connections:
1. **Dolt SQL Server** — for reading/writing CIQ, AAA, governance data
2. **Sacred Timeline CLI/MCP** — for git operations (captures, experiments, timeline)

---

## Step 1: Start the Dolt SQL Server

```bash
# Start on default MySQL port (3306)
cd /Volumes/Extreme-2TB/Git/sacred-timeline-dolt
dolt sql-server --port 3306 &

# Or on a dedicated port to avoid conflicts
dolt sql-server --port 3307 &
```

Verify it's running:
```bash
dolt sql -q "SELECT 1" --host 127.0.0.1 --port 3306 --user root
```

---

## Step 2: Connect from Yoda (OpenClaw)

Yoda connects via the `exec` tool using the `dolt` CLI, or via MySQL client:

```bash
# Direct Dolt CLI (no server needed)
cd /Volumes/Extreme-2TB/Git/sacred-timeline-dolt
dolt sql -q "INSERT INTO ciq_measurements (...) VALUES (...);"

# Via MySQL client (when server is running)
mysql -h 127.0.0.1 -P 3306 -u root -e "SELECT * FROM ciq_measurements"
```

**Yoda's daily CIQ logging** (what I'd do automatically):
```bash
# After each significant interaction
dolt sql -q "
  INSERT INTO agent_actions (
    action_id, agent_name, agent_model, action_type,
    input_summary, output_summary, human_decision, trust_impact
  ) VALUES (
    'aga_$(uuidgen)', 'yoda', 'glm-5-turbo', 'generate',
    'User asked for X', 'I produced Y', 'accepted', 0.1
  );
  INSERT INTO ciq_measurements (
    measurement_id, agent_name, accept_count, override_count,
    reject_count, total_interactions, trust_score
  ) VALUES (
    'ciq_$(uuidgen)', 'yoda', 8, 1, 0, 9, 0.89
  );
"
dolt add -A && dolt commit -m "ciq: daily measurement $(date +%Y-%m-%d)"
```

---

## Step 3: Connect from Other Agents

Any agent with shell access to the Mac Studio can use the same connection:

### Claude Code / Codex
```bash
# They can read/write directly via dolt CLI
cd /Volumes/Extreme-2TB/Git/sacred-timeline-dolt
dolt sql -q "SELECT trust_score, trust_calibration_curve FROM ciq_measurements ORDER BY measured_at DESC LIMIT 10;"
```

### MCP Server (future)
The Sacred Timeline MCP server already exists in the repo. Extended to include Dolt tools:

```typescript
// New MCP tools for the Dolt layer
'sacred_ciq_query'      — query CIQ measurements
'sacred_ciq_log'        — log a new CIQ measurement
'sacred_aaa_assess'     — create/update AAA assessment
'sacred_action_log'     — log an agent action
'sacred_trust_progress' — show trust progression over time
```

---

## Step 4: Gas City Integration

Gas City already runs Dolt at `/Volumes/Extreme-2TB/Git/gascity/.beads/dolt/` on port 13558.

Two options:
1. **Separate Dolt instances** (current) — Gas City for work tracking, Sacred Timeline for trust/governance
2. **Shared Dolt server** — one server, multiple databases (hq, hcos, sacred-timeline)

Option 2 is cleaner long-term:
```bash
# Copy sacred-timeline schema into Gas City's Dolt
cd /Volumes/Extreme-2TB/Git/gascity/.beads/dolt
dolt sql < /Volumes/Extreme-2TB/Git/sacred-timeline-dolt/SCHEMA.md
# Creates tables in a new 'sacred' database
```

---

## Day 1 Setup (What to Do Now)

```bash
# 1. Start Dolt SQL server (background)
cd /Volumes/Extreme-2TB/Git/sacred-timeline-dolt
nohup dolt sql-server --port 3307 > /tmp/sacred-dolt.log 2>&1 &

# 2. Verify connection
dolt sql -h 127.0.0.1 -P 3307 -u root -q "SHOW TABLES;"

# 3. That's it. Yoda and any agent with shell access can now read/write.
```

---

## Connection Summary

| Who | How | Port | What they access |
|-----|-----|------|-----------------|
| Yoda | `exec` + `dolt sql` | 3307 (or direct CLI) | CIQ, AAA, governance, actions |
| Claude Code | `exec` + `dolt sql` | 3307 | Same |
| Codex | `exec` + `dolt sql` | 3307 | Same |
| Gas City agents | `exec` + `dolt sql` | 13558 (existing) | Their own work tracking |
| Sacred Timeline CLI | `exec` + `sacred` | git | Captures, experiments, timeline |
| Future MCP clients | MCP protocol | TBD | All of the above |

No auth required on localhost. For UAE deployment, add MySQL auth + TLS.
