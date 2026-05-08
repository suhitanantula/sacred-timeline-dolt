# Sacred Timeline — Data Ledger

**Version-controlled data for AI governance.** Sacred Timeline's data layer, built on [Dolt](https://www.dolthub.com/) — the world's first version-controlled database.

Every CIQ trust measurement, agent action, governance decision, and capability assessment lives here — committed, branched, and queryable like git, but for data.

## Quick Start

```bash
# Start the Dolt SQL server (MySQL-compatible on port 3307)
dolt sql-server --port 3307 &

# Check it's running
dolt sql -q "SHOW TABLES;"

# View trust progression
dolt sql -q "SELECT measurement_id, agent_name, accept_rate, trust_score, trust_calibration_curve FROM ciq_measurements ORDER BY measured_at;"
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Agents                         │
│  Yoda · Claude Code · Codex · Gemini · Custom   │
└──────────┬──────────────────────┬───────────────┘
           │ dolt sql             │ sacred CLI
           ▼                      ▼
┌──────────────────┐   ┌─────────────────────┐
│   Dolt Server    │   │   Git Repository     │
│   (port 3307)    │   │   (documents, code)  │
│                  │   │                     │
│  ┌────────────┐  │   │  commits, branches  │
│  │ Governance │  │   │  experiments        │
│  │ proposals  │  │   │  captures           │
│  │ actions    │  │   └──────────┬──────────┘
│  │ exports    │  │              │
│  ├────────────┤  │              │ CIQ rows
│  │ Trust      │  │              │ logged per
│  │ ciq_       │◄─┼──────────────┘ capture
│  │ agent_     │  │
│  │ actions    │  │
│  ├────────────┤  │
│  │ Capability │  │
│  │ aaa_       │  │
│  │ teams      │  │
│  │ experiments│  │
│  └────────────┘  │
└──────────────────┘
```

**Two ledgers, one system:**
- **Git** tracks documents, code, and experiment artefacts
- **Dolt** tracks trust measurements, governance decisions, and capability assessments
- Both version-controlled. Both auditable. Both branchable.

## The Three Layers

| Layer | What | Tables | Question |
|---|---|---|---|
| **Governance** | Who did what, who approved | `proposals`, `actions`, `exports` | Who decided this was safe? |
| **Trust** | Was the AI output actually useful | `ciq_measurements`, `agent_actions` | Is trust growing or declining? |
| **Capability** | Is the team maturing | `aaa_assessments`, `teams`, `experiments` | Are we moving from Assist → Adapt? |

## Documentation

- [SCHEMA.md](./SCHEMA.md) — Full table definitions and design principles
- [CONNECTION.md](./CONNECTION.md) — How agents connect locally and remotely
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Deep dive on the two-ledger system
- [CIQ-GUIDE.md](./CIQ-GUIDE.md) — How to log and interpret trust measurements
- [CLI-AUTOLOG.md](./CLI-AUTOLOG.md) — Sacred Timeline CLI auto-logging spec
- [types.ts](./types.ts) — TypeScript type definitions mirroring the schema

## Connecting from Another Machine

See [CONNECTION.md](./CONNECTION.md) for full details. Quick version:

```bash
# Option 1: SSH tunnel to Mac Studio
ssh -L 3307:127.0.0.1:3307 suhit@mac-studio-ip

# Option 2: Clone from DoltHub (after push)
dolt clone suhitanantula/sacred-timeline-dolt
cd sacred-timeline-dolt
dolt sql-server --port 3307 &

# Then connect from any MySQL client
# Host: 127.0.0.1, Port: 3307, User: root (no password)
```

## Repos

| Repo | What it tracks |
|---|---|
| [sacred-timeline](https://github.com/suhitanantula/sacred-timeline) | Open-source CLI, skills, MCP server |
| `sacred-timeline-private` | Desktop extension, enterprise features, tests |
| `sacred-timeline-dolt` (this repo) | Data ledger schema, docs, types (git side) |
| DoltHub (pending) | Version-controlled data — CIQ, governance, AAA |

## Status

- ✅ 8 tables deployed across 3 layers
- ✅ Dolt SQL server running on Mac Studio (port 3307)
- ✅ First CIQ measurements logged
- ✅ TypeScript types and schema documentation
- 🔄 Sacred Timeline CLI auto-logging (spec in progress)
- 🔄 DoltHub remote (needs account setup)
- 🔄 UAE PMO deployment (Abeer engagement)

---

**The Helix Lab** — Building the governance layer for agentic work.
