import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../scripts/session.mjs';
const command = body => [process.execPath, '-e', body];

test('persistent native state and concurrent requests stay ordered', async () => {
  const session = new Session(command(`let n=0;require('readline').createInterface({input:process.stdin}).on('line',s=>{n+=JSON.parse(s).add;console.log(JSON.stringify({status:200,state:n}))})`));
  try {
    assert.deepEqual(await Promise.all([session.request({add:2}),session.request({add:3})]), [{status:200,state:2},{status:200,state:5}]);
  } finally { await session.close(); }
});
test('malformed stdout terminates the session and rejects pending work', async () => {
  const session = new Session(command(`process.stdin.once('data',()=>console.log('not-json'))`));
  try { await assert.rejects(session.request({}), SyntaxError); await assert.rejects(session.request({}), SyntaxError); }
  finally { await session.close(); }
});
test('a stalled runner fails within the configured response deadline', async () => {
  const session = new Session(command('process.stdin.resume()'), {timeoutMs:100});
  try { await assert.rejects(session.request({}), /timed out/); }
  finally { await session.close(); }
});
test('early process exit fails a pending action', async () => {
  const session = new Session(command('process.stdin.once("data",()=>process.exit(7))'));
  try { await assert.rejects(session.request({}), /exited/); }
  finally { await session.close(); }
});
test('oversized output without a newline is bounded', async () => {
  const session = new Session(command('process.stdin.once("data",()=>process.stdout.write("x".repeat(200)))'), {maxBytes:100});
  try { await assert.rejects(session.request({}), /size limit/); }
  finally { await session.close(); }
});
test('spawn errors and invalid requests fail clearly', async () => {
  assert.throws(() => new Session([]));
  const session = new Session(['/this-native-runner-does-not-exist']);
  try { await assert.rejects(session.request({}), /ENOENT/); }
  finally { await session.close(); }
});
