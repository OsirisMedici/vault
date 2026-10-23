// Reconstruct public responses. Never forward native/engine objects or messages.
const states = new Set('ready import_required engine_unavailable host_unavailable needs_private_unlock accounts_ready unsupported_provider verification_required credentials_rejected signed_in denied expired cancelled failed'.split(' '));
const reasons = new Set('invalid_request host_transport_unavailable host_control_unavailable origin_mismatch selection_invalid selection_expired unsupported_origin metadata_unavailable credential_unavailable host_operation_failed identity_unverified identity_mismatch owner_verification_required login_rejected request_in_progress cancelled form_unavailable clipboard_unavailable credential_mismatch'.split(' '));
export const boundedText = (value, max = 256) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, max) : '';
export function publicResult(value) {
  const result = { state: states.has(value?.state) ? value.state : 'failed' };
  if (typeof value?.requestId === 'string') result.requestId = boundedText(value.requestId, 80);
  if (reasons.has(value?.reasonCode)) result.reasonCode = value.reasonCode;
  if (typeof value?.selectionRequired === 'boolean') result.selectionRequired = value.selectionRequired;
  if (Array.isArray(value?.accounts)) result.accounts = value.accounts.slice(0, 50).map(a => ({
    selectionId: boundedText(a.selectionId, 80), name: boundedText(a.name), username: boundedText(a.username),
    origins: a.origins.filter(o => ['https://app.clickup.com', 'https://app.godial.cc'].includes(o)), supported: a.supported === true,
  }));
  if (value?.account) result.account = {name: boundedText(value.account.name), username: boundedText(value.account.username), origin: boundedText(value.account.origin)};
  return result;
}
