// Evaluate this trusted function in the tool runner, which supplies `tools`.
async function runVaultChatCommand(sessionId, command, maxSteps = 130) {
  const allowed = new Set(['preview_status', 'preview_click', 'preview_evaluate',
    'preview_press', 'preview_navigate', 't3_preview_list']);
  let buffer = '';
  let calls = 0;
  let chunk = await tools.write_stdin({ session_id: sessionId,
    chars: JSON.stringify({ type: 'command', id: 'request-' + Date.now(), ...command }) + '\n',
    yield_time_ms: 250, max_output_tokens: 14000 });
  for (let step = 0; step < maxSteps; step++) {
    buffer += chunk.output ?? '';
    const messages = [];
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      try { messages.push(JSON.parse(line)); } catch { /* Ignore PTY framing. */ }
    }
    const result = messages.find(m => m.type === 'result');
    if (result) return { toolCalls: calls, result: result.result };
    const request = messages.find(m => m.type === 'tool_request');
    if (request) {
      if (!allowed.has(request.name)) throw new Error('unsupported_relay_tool');
      let response;
      try {
        const raw = await tools['mcp__t3_code__' + request.name](request.args);
        if (raw.isError) throw new Error('host_operation_failed');
        let data = raw.structuredContent;
        if (!data) {
          try { data = JSON.parse(raw.content?.find(c => c.type === 'text')?.text); }
          catch { data = {}; }
        }
        response = { type: 'tool_response', id: request.id, result: data };
      } catch { response = { type: 'tool_response', id: request.id, error: true }; }
      calls++;
      chunk = await tools.write_stdin({ session_id: sessionId,
        chars: JSON.stringify(response) + '\n', yield_time_ms: 250, max_output_tokens: 14000 });
    } else {
      chunk = await tools.write_stdin({ session_id: sessionId,
        chars: '', yield_time_ms: 250, max_output_tokens: 14000 });
    }
  }
  throw new Error('relay_step_budget_exceeded');
}
