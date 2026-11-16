import { marketingDevClient as supabase } from "./marketingDevClient.js";
import { deriveMarketingAttention } from './marketingAttention.js';

export const CAMPAIGN_STATUSES = ["draft", "planned", "active", "paused", "completed", "cancelled"];
export const APPROVAL_STATES = ["draft", "in_review", "changes_requested", "approved"];
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"];
export const ASSET_TYPES = ["social_copy", "email_copy", "web_copy", "print_copy", "image_brief", "video_brief"];

export function splitList(value = "") {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function createAttributionKey(name, id = crypto.randomUUID()) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "campaign";
  return `${slug}-${id.slice(0, 8)}`;
}

async function rpc(name, args) {
  if (!supabase) throw new Error("Marketing storage is not configured.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || "Marketing request could not be completed.");
  return data;
}

export async function readMarketingWorkspace(workspaceId = null) {
  const data = await rpc('read_marketing_attention_workspace', { p_workspace: workspaceId });
  return { ...data, attention: deriveMarketingAttention(data) };
}

export function saveMarketingCampaign(workspaceId, campaign, expectedRevision = null) {
  const { id, ...payload } = campaign;
  return rpc("save_marketing_campaign", {
    p_id: id,
    p_workspace: workspaceId,
    p_expected_revision: expectedRevision,
    p_payload: payload,
  });
}

export function saveMarketingBrief(workspaceId, campaign, payload) {
  return rpc("save_marketing_brief", { p_workspace: workspaceId, p_campaign: campaign.id, p_expected_revision: campaign.revision, p_payload: payload });
}

export function saveMarketingTask(workspaceId, campaignId, task, payload) {
  return rpc("save_marketing_task", { p_workspace: workspaceId, p_campaign: campaignId, p_id: task.id, p_expected_revision: task.revision ?? null, p_payload: payload });
}

export function writeMarketingAsset(workspaceId, campaignId, asset, action, payload) {
  return rpc("write_marketing_asset", { p_workspace: workspaceId, p_campaign: campaignId, p_id: asset.id, p_expected_revision: asset.revision ?? null, p_action: action, p_payload: payload });
}

export function readMarketingAssetHistory(workspaceId, assetId) {
  return rpc("read_marketing_asset_history", { p_workspace: workspaceId, p_asset: assetId });
}

export function readMarketingAgentRuns(workspaceId, campaignId = null) {
  return rpc('read_marketing_agent_runs', { p_workspace: workspaceId, p_campaign: campaignId });
}

export function readMarketingAgentRun(workspaceId, runId) {
  return rpc('read_marketing_agent_run', { p_workspace: workspaceId, p_run: runId });
}

export async function runMarketingAgent(request) {
  if (!supabase) throw new Error('Marketing storage is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to initiate an agent run.');
  const response = await fetch('/api/marketing-agent-run', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(request),
  });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }
  if (!result || typeof result !== 'object') throw new Error('Agent API did not return JSON. Check the development server and API configuration.');
  if (!response.ok) throw new Error(result.error || `Agent run failed (${result.run?.error_code || 'unavailable'}).`);
  return result.run;
}

export function resolveMarketingAgentRun(workspaceId, runId, action, selection = [], note = '') {
  return rpc('resolve_marketing_agent_run', { p_workspace: workspaceId, p_run: runId, p_action: action, p_selection: selection, p_note: note });
}

export async function commandMarketingOrchestration(request) {
  if (!supabase) throw new Error('Marketing storage is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to assign agent work.');
  const response = await fetch('/api/marketing-orchestration', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(request) });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }
  if (!result || typeof result !== 'object') throw new Error('Agent API did not return JSON. Check the development server and API configuration.');
  if (!response.ok) throw new Error(result.error || 'Orchestration unavailable.');
  return result.orchestration;
}

export function saveMarketingHumanConstraints(workspaceId, asset, expectedSetId, constraints) {
  return rpc('save_marketing_human_constraints', { p_workspace: workspaceId, p_asset: asset.id, p_expected_revision: asset.revision, p_expected_set: expectedSetId, p_constraints: constraints });
}

export function saveMarketingPolicy(workspaceId, campaignId, expectedSet, rules) {
  return rpc('save_marketing_policy', { p_workspace: workspaceId, p_campaign: campaignId, p_expected_set: expectedSet, p_rules: rules });
}
