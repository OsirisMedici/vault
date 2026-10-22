// SPDX-License-Identifier: GPL-3.0-only
// Run inside the trusted tool runner, which provides `tools`.
// The loop performs the whole command without model-mediated field/key relays.
// Credentials stay in ghl-session.mjs; requests contain fixed controls only.
export async function runVault2Command(sessionId, command, maxSteps=130) {
  const allowed=new Set(['preview_status','t3_preview_list','preview_click','preview_evaluate','preview_press']);
  const start=Date.now();let calls=0,buffer='';
  let chunk=await tools.write_stdin({session_id:sessionId,chars:JSON.stringify({type:'command',...command})+'\n',yield_time_ms:250,max_output_tokens:4000});
  for(let step=0;step<maxSteps;step++){
    buffer+=chunk.output??'';const messages=[];let index;
    while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);try{messages.push(JSON.parse(line));}catch{}}
    const result=messages.find(m=>m.type==='result');
    if(result)return {elapsedMs:Date.now()-start,toolCalls:calls,result:result.result};
    const request=messages.find(m=>m.type==='tool_request');
    if(request){
      if(!allowed.has(request.name))throw new Error('unsupported_relay_tool');
      let response;
      try{
        const raw=await tools['mcp__t3_code__'+request.name](request.args);
        if(raw.isError)throw new Error('host_operation_failed');
        const result=raw.structuredContent??JSON.parse(raw.content.find(c=>c.type==='text').text);
        response={type:'tool_response',id:request.id,result};
      }catch{response={type:'tool_response',id:request.id,error:true};}
      calls++;
      chunk=await tools.write_stdin({session_id:sessionId,chars:JSON.stringify(response)+'\n',yield_time_ms:250,max_output_tokens:4000});
    }else{
      chunk=await tools.write_stdin({session_id:sessionId,chars:'',yield_time_ms:250,max_output_tokens:4000});
    }
  }
  throw new Error('relay_step_budget_exceeded');
}
