/**
 * Sacred Timeline — TypeScript types mirroring the unified Dolt schema.
 *
 * Three layers: Governance → Trust (CIQ) → Capability (AAA).
 * Keep these in sync with SCHEMA.md when either changes.
 */

// ─── Shared Enums ────────────────────────────────────────────────

export type ActorType = 'human' | 'agent' | 'human_with_agent';
export type AiInvolvement = 'none' | 'assisted' | 'generated' | 'autonomous';
export type AaaLevel = 'Assist' | 'Augment' | 'Adapt';
export type TrustCurve = 'declining' | 'flat' | 'building' | 'plateau' | 'high';
export type ToolSurface = 'cli' | 'web' | 'mcp' | 'api';
export type ProposalStatus = 'draft' | 'open' | 'approved' | 'rejected' | 'abandoned' | 'merged';
export type ExperimentStatus = 'planned' | 'active' | 'completed' | 'abandoned';

// ─── Layer 1: Governance Ledger ─────────────────────────────────

export interface Proposal {
  id: string;                          // prop_...
  title: string;
  rationale?: string;
  sourceBranch: string;
  targetBranch: string;
  status: ProposalStatus;

  authorType: ActorType;
  authorId: string;
  humanOwner?: string;

  aiInvolvement: AiInvolvement;

  reviewerId?: string;
  reviewerType?: ActorType;
  reviewDecision?: 'approved' | 'rejected' | 'changes_requested';
  reviewerNote?: string;

  captureHash?: string;
  diffSummary?: string;
  filesChanged?: string[];

  providerType?: 'github' | 'gitlab' | 'gitea';
  providerRef?: string;

  proposedAt: string;                  // ISO 8601
  reviewedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Action {
  id: string;                          // act_...
  timestamp: string;

  actorType: ActorType;
  actorIdentitySource: 'mcp_client' | 'env_var' | 'git_author' | 'manual';
  actorName: string;
  actorSessionId?: string;

  toolSurface: ToolSurface;
  action: 'capture' | 'experiment' | 'propose' | 'review' | 'resolve' | 'export' | 'draft' | 'log' | 'sync';
  message?: string;

  branch?: string;
  captureHash?: string;
  filesChanged?: string[];

  proposalId?: string;
  exportId?: string;

  aiInvolvement: AiInvolvement;
  policyEnvelope?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Export {
  id: string;                          // exp_...
  proposalId: string;
  sourceCommit: string;
  sourceFiles: string[];
  outputFiles: string[];
  outputChecksums: Record<string, string>;
  exportFormat?: 'word' | 'pdf' | 'pptx';
  exportCommand?: string;

  actorId: string;
  actorType: ActorType;
  actionId?: string;

  exportedAt: string;
}

// ─── Layer 2: Trust Ledger (CIQ) ────────────────────────────────

export interface CiqMeasurement {
  id: string;                          // ciq_...
  experimentId?: string;
  teamId?: string;
  measuredAt: string;

  agentName: string;
  agentModel?: string;
  agentSessionId?: string;

  acceptCount: number;
  overrideCount: number;
  rejectCount: number;
  totalInteractions: number;

  // Computed (stored in Dolt, derived in TS)
  acceptRate?: number;
  overrideRate?: number;

  trustScore?: number;
  trustCalibrationCurve?: TrustCurve;

  notes?: string;

  proposalId?: string;
  actionId?: string;
}

export interface AgentAction {
  id: string;                          // aga_...
  experimentId?: string;
  agentName: string;
  agentModel?: string;

  actionType: 'generate' | 'suggest' | 'review' | 'transform' | 'execute' | 'query';
  inputSummary?: string;
  outputSummary?: string;

  humanDecision?: 'accepted' | 'overridden' | 'rejected' | 'deferred' | 'no_response';
  humanOverrideReason?: string;

  trustImpact?: number;                // -1.0 to 1.0
  qualityRating?: 'poor' | 'adequate' | 'good' | 'excellent';

  proposalId?: string;
  ciqMeasurementId?: string;

  createdAt: string;
}

// ─── Layer 3: Capability Ledger (AAA) ───────────────────────────

export interface AaaAssessment {
  id: string;                          // aaa_...
  teamId?: string;
  assessedAt: string;

  assessor: string;
  assessorType: ActorType;

  currentLevel: AaaLevel;
  previousLevel?: AaaLevel;

  aiLiteracyScore?: number;            // 0.0 – 1.0
  collaborationMaturityScore?: number;
  governanceReadinessScore?: number;
  toolFluencyScore?: number;

  topLevelBarrier?: string;
  recommendedNextAction?: string;

  basedOnCiqIds?: string[];
  basedOnExperimentIds?: string[];
}

export interface Team {
  id: string;                          // team_...
  name: string;
  organisation?: string;
  description?: string;
  createdAt: string;
}

export interface Experiment {
  id: string;                          // exp_...
  teamId?: string;
  name: string;
  description?: string;
  status: ExperimentStatus;

  startedAt?: string;
  completedAt?: string;
  aaaLevelAtStart?: AaaLevel;
  aaaLevelAtEnd?: AaaLevel;

  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────

export function inferAiInvolvement(
  aiInvolvement?: AiInvolvement,
  aiAssisted?: boolean
): AiInvolvement {
  if (aiInvolvement && aiInvolvement !== 'none') return aiInvolvement;
  if (aiAssisted) return 'assisted';
  return 'none';
}

export function computeAcceptRate(acceptCount: number, total: number): number {
  return total > 0 ? Math.round((acceptCount / total) * 10000) / 10000 : 0;
}

export function computeOverrideRate(overrideCount: number, total: number): number {
  return total > 0 ? Math.round((overrideCount / total) * 10000) / 10000 : 0;
}

export function inferTrustCurve(
  currentScore: number,
  previousScore?: number
): TrustCurve {
  if (!previousScore) return 'flat';
  const delta = currentScore - previousScore;
  if (currentScore >= 0.9) return 'high';
  if (delta > 0.05) return 'building';
  if (delta < -0.05) return 'declining';
  return 'plateau';
}
