import { spawn } from 'node:child_process';

/** Persistent NDJSON driver for an already-built native executable. */
export class Session {
  constructor(command, { cwd, timeoutMs = 5000, maxBytes = 1_048_576 } = {}) {
    if (!Array.isArray(command) || !command.length || command.some(s => typeof s !== 'string' || !s)) throw new Error('Provide an executable argument array.');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid session limits.');
    this.timeoutMs = timeoutMs;
    this.maxBytes = maxBytes;
    this.pending = [];
    this.buffer = '';
    this.stderr = '';
    this.closed = false;
    const [executable, ...args] = command;
    this.child = spawn(executable, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.exited = new Promise(resolve => this.child.once('close', resolve));
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', data => this.receive(data));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', data => { this.stderr = (this.stderr + data).slice(-8000); });
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => this.fail(new Error(`Native runner exited (${signal || code}). ${this.stderr}`)));
    this.child.stdin.on('error', error => this.fail(error));
  }
  receive(data) {
    if (this.closed) return;
    this.buffer += data;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (Buffer.byteLength(line) > this.maxBytes) { this.fail(new Error('Native response exceeds the size limit.')); return; }
      const request = this.pending[0];
      if (!request) { this.fail(new Error('Unexpected native output.')); return; }
      try {
        const response = JSON.parse(line);
        if (!Number.isInteger(response?.status) || response.status < 100 || response.status > 599) throw new Error('Invalid native response status.');
        this.pending.shift(); clearTimeout(request.timer); request.resolve(response);
      } catch (error) { this.fail(error); return; }
    }
    if (Buffer.byteLength(this.buffer) > this.maxBytes) this.fail(new Error('Native response exceeds the size limit.'));
  }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    this.failure = error;
    for (const request of this.pending.splice(0)) { clearTimeout(request.timer); request.reject(error); }
    this.child.kill();
  }
  request(input) {
    if (this.closed) return Promise.reject(this.failure || new Error('Native session is closed.'));
    let line;
    try {
      line = JSON.stringify(input);
      if (typeof line !== 'string' || Buffer.byteLength(line) > this.maxBytes) throw new Error('Invalid or oversized native request.');
    } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Native response timed out. ${this.stderr}`)), this.timeoutMs);
      this.pending.push({ resolve, reject, timer });
      this.child.stdin.write(line + '\n');
    });
  }
  async close() {
    this.fail(new Error('Native session closed.'));
    // A broken runner may ignore SIGTERM; cleanup is bounded independently of requests.
    const kill = setTimeout(() => this.child.kill('SIGKILL'), 500);
    try { await this.exited; } finally { clearTimeout(kill); }
  }
}
