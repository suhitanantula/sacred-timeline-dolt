# CIQ Guide — Measuring Trust in Agent Output

## What is CIQ?

**Co-Intelligence Quotient** — a measurable trust score between a human and an AI agent.

Not "how smart is the AI." Not "how much does the human trust AI in general." Specifically: **in this interaction, with this agent, on this task — did the human accept, override, or reject the output?**

CIQ is a ratio, not a sentiment. It's counted, not surveyed.

## The Three Decisions

Every agent interaction falls into one of three categories:

| Decision | Meaning | CIQ Impact |
|---|---|---|
| **Accept** | Human used the output as-is or with minor edits | +1 to accept_count |
| **Override** | Human modified the output significantly | +1 to override_count |
| **Reject** | Human discarded the output entirely | +1 to reject_count |

**Accept rate** = accept_count / total_interactions

## Trust Score

The trust score is a human-assessed rating (0.0 – 1.0) that captures the *quality* dimension beyond raw acceptance:

- **0.0 – 0.3** — Low trust. Agent output mostly rejected or heavily overridden. Relationship is adversarial.
- **0.3 – 0.5** — Tentative. Some useful outputs but inconsistent. Human is supervising heavily.
- **0.5 – 0.7** — Building. Acceptance is growing. Human still checks everything but increasingly agrees.
- **0.7 – 0.85** — Strong. Most outputs accepted. Override is rare and usually minor. Trust is established.
- **0.85 – 1.0** — High trust. Agent operates with minimal supervision. Human reviews periodically.

## Trust Calibration Curve

The curve describes the *trajectory* of trust over time:

```
trust_score
1.0 ┤                              ╭─── HIGH
    │                         ╭─────╯
0.8 ┤                    ╭────╯ PLATEAU
    │               ╭────╯
0.6 ┤          ╭────╯ BUILDING
    │     ╭────╯
0.4 ┤────╯
    │──╯ FLAT
0.2 ┤╮
    │ DECLINING
0.0 ┼────────────────────────────────── time
```

- **Declining** — trust is falling. Something is broken. Investigate immediately.
- **Flat** — trust isn't growing. Agent isn't improving or human isn't giving it enough scope.
- **Building** — trust is growing. This is the healthy state for new agent relationships.
- **Plateau** — trust has stabilised at a high level. Agent is reliable. Consider expanding scope.
- **High** — trust is very high. Agent is autonomous on most tasks. Ensure governance keeps up.

## How to Log CIQ

### Manual (current)

```sql
INSERT INTO ciq_measurements (
    measurement_id, agent_name, agent_model,
    accept_count, override_count, reject_count, total_interactions,
    trust_score, trust_calibration_curve, notes
) VALUES (
    'ciq_20260508_002', 'yoda', 'glm-5-turbo',
    12, 1, 0, 13,
    0.92, 'building', 'Schema deployment session — strong acceptance rate'
);
```

### Via Sacred Timeline CLI (planned)

```bash
sacred ciq --agent yoda --model glm-5-turbo \
  --accept 12 --override 1 --reject 0 \
  --trust 0.92 --curve building \
  --note "Schema deployment session"
```

### Auto-logged (planned)

When Sacred Timeline CLI auto-logging is active, every `sacred capture` generates a CIQ row automatically:

```bash
sacred capture "Updated briefing with new policy section" --agent yoda
# → git commit created
# → CIQ row inserted (accept assumed unless human amends within N minutes)
```

## Reading the Data

### Trust progression over time

```sql
SELECT 
    measured_at,
    agent_name,
    accept_rate,
    trust_score,
    trust_calibration_curve
FROM ciq_measurements
WHERE agent_name = 'yoda'
ORDER BY measured_at;
```

### Agent comparison

```sql
SELECT 
    agent_name,
    AVG(accept_rate) as avg_accept_rate,
    AVG(trust_score) as avg_trust,
    COUNT(*) as measurements
FROM ciq_measurements
GROUP BY agent_name;
```

### Declining trust detection

```sql
SELECT agent_name, trust_score, trust_calibration_curve, notes
FROM ciq_measurements
WHERE trust_calibration_curve = 'declining'
ORDER BY measured_at DESC;
```

## Interpreting CIQ for Governance

**The minister asks "so what?"** — here's the answer:

> "Over 4 weeks, the helix-governance agent's trust score progressed from 0.67 to 0.94. Accept rate moved from 67% to 94%. The trust curve moved from 'building' to 'high'. The agent is now operating with minimal human override on briefing generation tasks."

That's not a vibe. That's a measurement. That's CIQ.

## CIQ and AAA

CIQ feeds directly into AAA (Assist → Augment → Adapt) capability assessments:

- **Assist level** — trust 0.3–0.5, agent supports but human drives
- **Augment level** — trust 0.5–0.8, agent transforms work, human validates
- **Adapt level** — trust 0.8+, agent creates new possibilities, human governs

AAA assessments reference CIQ IDs as evidence. The progression from Assist to Adapt is backed by trust data, not self-assessment.
