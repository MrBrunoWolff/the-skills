import { createInterface } from 'node:readline';
import { route, inScope, readSettings } from './router.mjs';

const tool = {
  name: 'choose_model',
  description: 'Optional Jev adviser for an already-planned general-purpose Codex delegation in the configured workspace. It recommends a model before spawn; it never runs tasks or changes permissions. Do not call for explicit model choices or typed agents. unchanged means preserve the intended spawn arguments exactly.',
  inputSchema: { type: 'object', required: ['cwd', 'tool_input'], additionalProperties: false, properties: { cwd: { type: 'string', description: 'Absolute current session workspace directory.' }, tool_input: { type: 'object', description: 'The complete intended spawn arguments, including message and any explicit settings.', additionalProperties: true } } },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
};
async function enabled() {
  if (process.env.AGENT_ROUTER === 'off' || !(process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY)) return false;
  try { return await inScope(process.cwd(), (await readSettings()).scope_root); } catch { return false; }
}
async function handle(request) {
  if (!Object.hasOwn(request, 'id')) return; // MCP notifications have no response.
  const send = result => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  switch (request.method) {
    case 'initialize': return send({ protocolVersion: request.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'workspace-model-router', version: '1.0.0' } });
    case 'ping': return send({});
    case 'tools/list': return send({ tools: await enabled() ? [tool] : [] });
    case 'tools/call': {
      if (request.params?.name !== 'choose_model') break;
      const args = request.params.arguments;
      const result = await enabled() ? await route({ cwd: args?.cwd, tool_name: 'spawn_agent', tool_input: args?.tool_input }) : { outcome: 'unchanged', reason: 'inactive' };
      return send({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
    }
    default: break;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method or tool not found' } }) + '\n');
}
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  try { await handle(JSON.parse(line)); }
  catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }) + '\n'); }
}
