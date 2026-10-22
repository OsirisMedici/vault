// Closed host diagnostics only. Never expose native messages or captured output.
export function browserFailure(error, fallback = 'host_operation_failed') {
  const reasonCode = ['host_transport_unavailable', 'host_control_unavailable',
    'origin_mismatch', 'form_unavailable', 'clipboard_unavailable'].includes(error?.message)
    ? error.message : fallback;
  return {
    state: ['origin_mismatch', 'host_control_unavailable'].includes(reasonCode) ? 'denied' : 'host_unavailable',
    reasonCode,
  };
}
