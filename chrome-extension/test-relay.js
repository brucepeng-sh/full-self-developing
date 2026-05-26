// chrome-extension/test-relay.js
'use strict';

const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

console.log('--- FSD Chrome Extension MCP End-to-End Test ---');

// 1. Start the MCP server subprocess
const mcpScript = path.join(__dirname, '..', 'agents', 'chrome-extension-mcp.js');
console.log(`Starting MCP server at: ${mcpScript}`);

const mcpProcess = spawn('node', [mcpScript], {
  env: { ...process.env, FSD_RELAY_PORT: '9223' },
  stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
});

mcpProcess.stderr.on('data', (data) => {
  console.log(`[MCP Server Stderr]: ${data.toString().trim()}`);
});

let wsClient = null;
let testPassed = false;

// Helper to send JSON-RPC requests via stdio to the MCP server
function sendMcpRequest(method, params, id) {
  const req = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  console.log(`[Test] Sending to MCP Stdio:`, JSON.stringify(req));
  mcpProcess.stdin.write(JSON.stringify(req) + '\n');
}

// 2. Connect mock Chrome Extension WebSocket Client after a brief delay
setTimeout(() => {
  console.log('\n[Test] Connecting mock Chrome Extension via WebSocket...');
  wsClient = new WebSocket('ws://localhost:9223');

  wsClient.on('open', () => {
    console.log('[Mock Extension] Connected to FSD relay server!');

    // 3. Once connected, trigger an MCP Tool List request
    sendMcpRequest('tools/list', {}, 1);
  });

  wsClient.on('message', (message) => {
    const data = JSON.parse(message);
    console.log(`[Mock Extension] Received message from FSD:`, data);

    // If it's a browser command, mock a successful response
    if (data.action === 'browser_navigate') {
      console.log(`[Mock Extension] Processing 'browser_navigate' to: ${data.params.url}...`);
      setTimeout(() => {
        const response = {
          id: data.id,
          success: true,
          result: { url: data.params.url, message: 'Mock navigation successful!' }
        };
        console.log(`[Mock Extension] Sending response back to FSD:`, response);
        wsClient.send(JSON.stringify(response));
      }, 500);
    }
  });

  wsClient.on('error', (err) => {
    console.error('[Mock Extension] WebSocket Error:', err.message);
  });
}, 1000);

// Buffer to store stdio output from the MCP server
let stdoutBuffer = '';

mcpProcess.stdout.on('data', (data) => {
  stdoutBuffer += data.toString();
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop(); // keep partial last line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.log(`[Test] Received from MCP Stdio:`, response);

      // Handle tools/list response
      if (response.id === 1) {
        console.log('\n[Test] Tool listing verified! Available tools:');
        response.result.tools.forEach(t => console.log(` - ${t.name}: ${t.description}`));

        // 4. Now test invoking browser_navigate
        console.log('\n[Test] Invoking browser_navigate tool...');
        sendMcpRequest('tools/call', {
          name: 'browser_navigate',
          arguments: { url: 'https://github.com' }
        }, 2);
      }

      // Handle tools/call response
      if (response.id === 2) {
        console.log('\n[Test] Tool call response received:');
        console.log(JSON.stringify(response.result, null, 2));

        if (response.result && response.result.content && response.result.content[0].text.includes('Success')) {
          console.log('\n=== TEST SUCCESSFUL ===');
          testPassed = true;
          cleanup();
        } else {
          console.error('\n=== TEST FAILED: Unexpected response format ===');
          cleanup();
        }
      }
    } catch (e) {
      console.log(`[MCP Server Stdout Raw]: ${line}`);
    }
  }
});

function cleanup() {
  console.log('Cleaning up processes...');
  if (wsClient) {
    wsClient.close();
  }
  mcpProcess.kill();
  setTimeout(() => {
    process.exit(testPassed ? 0 : 1);
  }, 500);
}

// Timeout backup
setTimeout(() => {
  console.error('\n=== TEST TIMEOUT: Test did not finish in 10 seconds ===');
  cleanup();
}, 10000);
