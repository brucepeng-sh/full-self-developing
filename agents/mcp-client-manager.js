'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
// const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const engineConfig = require('./engine-config');
const { serverLog, errorLog } = require('../logger');

class McpClientManager {
    constructor() {
        this.servers = new Map(); // name -> { client, transport, status, tools, config }
    }

    async initialize(serverConfigs) {
        if (!serverConfigs || !Array.isArray(serverConfigs)) return;
        serverLog(`[McpManager] Initializing ${serverConfigs.length} MCP servers...`);
        for (const config of serverConfigs) {
            this.connectServer(config).catch(e => {
                errorLog(`[McpManager] Failed to auto-connect ${config.name}: ${e.message}`);
            });
        }
    }

    async connectServer(config) {
        const { name, command, args, env, url } = config;
        
        if (this.servers.has(name)) {
            await this.removeServer(name);
        }

        let transport;
        if (url) {
            // For now only stdio is robustly implemented, but we could add SSE here
            // transport = new SSEClientTransport(new URL(url));
            throw new Error('SSE Transport not fully implemented yet.');
        } else if (command) {
            serverLog(`[McpManager] Connecting to MCP Server via stdio: ${name} (${command} ${args ? args.join(' ') : ''})`);
            transport = new StdioClientTransport({
                command,
                args: args || [],
                env: env ? { ...process.env, ...env } : process.env
            });
        } else {
            throw new Error(`MCP Server ${name} must specify either 'command' or 'url'`);
        }

        const client = new Client({
            name: "Full-Self-Developing",
            version: "1.0.0"
        }, {
            capabilities: {
                tools: {}
            }
        });

        this.servers.set(name, { client, transport, config, status: 'connecting', tools: [] });

        transport.onerror = (e) => {
            errorLog(`[McpManager] Server ${name} transport error: ${e.message}`);
        };
        
        transport.onclose = () => {
            serverLog(`[McpManager] Server ${name} transport closed.`);
            const srv = this.servers.get(name);
            if (srv) srv.status = 'disconnected';
        };

        try {
            await client.connect(transport);
            const srv = this.servers.get(name);
            if (srv) {
                srv.status = 'connected';
                // Fetch tools
                const toolsResponse = await client.listTools();
                srv.tools = toolsResponse.tools || [];
                serverLog(`[McpManager] Server ${name} connected successfully. Tools loaded: ${srv.tools.length}`);
            }
        } catch (e) {
            errorLog(`[McpManager] Error connecting to ${name}: ${e.message}`);
            const srv = this.servers.get(name);
            if (srv) srv.status = 'error';
            throw e;
        }
    }

    async addServer(config) {
        const existing = engineConfig.getMcpServers() || [];
        const updated = existing.filter(s => s.name !== config.name);
        updated.push(config);
        engineConfig.saveMcpServers(updated);
        
        await this.connectServer(config);
        return { name: config.name, status: 'connected' };
    }

    async removeServer(name) {
        const srv = this.servers.get(name);
        if (srv) {
            try {
                await srv.client.close();
            } catch (e) {
                errorLog(`[McpManager] Error closing client for ${name}: ${e.message}`);
            }
            this.servers.delete(name);
        }
        
        const existing = engineConfig.getMcpServers() || [];
        const updated = existing.filter(s => s.name !== name);
        engineConfig.saveMcpServers(updated);
        
        serverLog(`[McpManager] Removed MCP Server: ${name}`);
        return { success: true };
    }

    listServers() {
        const result = [];
        for (const [name, srv] of this.servers.entries()) {
            result.push({
                name,
                status: srv.status,
                command: srv.config.command,
                args: srv.config.args,
                url: srv.config.url,
                toolsCount: srv.tools ? srv.tools.length : 0
            });
        }
        return result;
    }

    listAllTools() {
        const allTools = [];
        for (const [name, srv] of this.servers.entries()) {
            if (srv.status === 'connected' && srv.tools) {
                for (const tool of srv.tools) {
                    allTools.push({
                        serverName: name,
                        ...tool
                    });
                }
            }
        }
        return allTools;
    }

    async callTool(serverName, toolName, args) {
        const srv = this.servers.get(serverName);
        if (!srv || srv.status !== 'connected') {
            throw new Error(`Server ${serverName} is not connected.`);
        }
        serverLog(`[McpManager] Calling tool ${toolName} on server ${serverName}...`);
        const result = await srv.client.callTool({
            name: toolName,
            arguments: args
        });
        return result;
    }
}

module.exports = new McpClientManager();
