// agents/chrome-extension-mcp.js
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { WebSocketServer } = require('ws');

// Configure relay port (default 9223)
const PORT = process.env.FSD_RELAY_PORT ? parseInt(process.env.FSD_RELAY_PORT, 10) : 9223;

// Active WebSocket connection to the extension
let activeWs = null;
const pendingRequests = new Map(); // id -> { resolve, reject, timeout }

// Start WebSocket Server
const wss = new WebSocketServer({ port: PORT });
console.error(`[McpRelay] WebSocket Server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  activeWs = ws;
  console.error('[McpRelay] Chrome Extension connected.');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        // Heartbeat response
        ws.send(JSON.stringify({ type: 'ping' }));
        return;
      }

      const { id, success, result, error } = data;
      if (id && pendingRequests.has(id)) {
        const { resolve, reject, timeout } = pendingRequests.get(id);
        clearTimeout(timeout);
        pendingRequests.delete(id);

        if (success) {
          resolve(result);
        } else {
          reject(new Error(error || 'Command failed inside browser extension'));
        }
      }
    } catch (err) {
      console.error('[McpRelay] Error parsing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    activeWs = null;
    console.error('[McpRelay] Chrome Extension disconnected.');
    // Reject all pending requests
    for (const [id, { reject, timeout }] of pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(new Error('Chrome Extension disconnected during execution.'));
    }
    pendingRequests.clear();
  });
});

// Helper to send command to the extension
function sendBrowserCommand(action, params = {}) {
  if (!activeWs) {
    throw new Error('No Chrome Extension connected. Please open Chrome, load the FSD Browser Relay extension, and make sure it indicates "已连接" (Connected).');
  }

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2);

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Command '${action}' timed out waiting for Chrome Extension response.`));
    }, 30000); // 30s timeout

    pendingRequests.set(id, { resolve, reject, timeout });
    activeWs.send(JSON.stringify({ id, action, params }));
  });
}

// Create MCP Server instance
const server = new Server(
  {
    name: 'chrome-extension-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tool Listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'browser_navigate',
        description: 'Navigate the browser to a specific URL (or open a new tab if no tab is active). Use this to visit web pages.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The target URL (e.g. "https://github.com")',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_click',
        description: 'Click an HTML element on the active page using a CSS selector.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the element to click (e.g. "button.submit-btn", "#login")',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_type',
        description: 'Type text into an input or textarea element on the active page.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the input element (e.g. "input[type=\'text\']")',
            },
            text: {
              type: 'string',
              description: 'The text content to type.',
            },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'browser_get_html',
        description: 'Get the full outer HTML content of the active tab. Useful for reading web page contents.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Capture a visible screenshot of the active browser tab.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_evaluate',
        description: 'Evaluate custom JavaScript code in the context of the active page. Code should return a JSON-serializable value.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code string to execute (e.g., "return document.title;")',
            },
          },
          required: ['code'],
        },
      },
    ],
  };
});

// Register Tool Execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'browser_navigate':
        const navResult = await sendBrowserCommand('browser_navigate', { url: args.url });
        return {
          content: [{ type: 'text', text: `Successfully navigated to: ${args.url}. Details: ${navResult.message}` }],
        };

      case 'browser_click':
        await sendBrowserCommand('browser_click', { selector: args.selector });
        return {
          content: [{ type: 'text', text: `Successfully clicked element: ${args.selector}` }],
        };

      case 'browser_type':
        await sendBrowserCommand('browser_type', { selector: args.selector, text: args.text });
        return {
          content: [{ type: 'text', text: `Successfully typed text into element: ${args.selector}` }],
        };

      case 'browser_get_html':
        const htmlResult = await sendBrowserCommand('browser_get_html');
        return {
          content: [{ type: 'text', text: htmlResult.html }],
        };

      case 'browser_screenshot':
        const screenshotResult = await sendBrowserCommand('browser_screenshot');
        // Return image block
        return {
          content: [
            {
              type: 'image',
              data: screenshotResult.base64,
              mimeType: 'image/png',
            },
          ],
        };

      case 'browser_evaluate':
        const evalResult = await sendBrowserCommand('browser_evaluate', { code: args.code });
        return {
          content: [{ type: 'text', text: JSON.stringify(evalResult) }],
        };

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${err.message}` }],
    };
  }
});

// Start transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[McpRelay] Stdio Server Transport connected.');
}

main().catch((err) => {
  console.error('[McpRelay] Failed to start MCP server:', err);
  process.exit(1);
});
