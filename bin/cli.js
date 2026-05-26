#!/usr/bin/env node
'use strict';

// Set global mode flag before requiring anything
process.env.FSD_GLOBAL = 'true';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const engineConfig = require('../agents/engine-config');

// ANSI escape codes for coloring terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    blue: '\x1b[34m'
};

// Mascot & welcoming banner
const LOBSTER_BANNER = `
${colors.red}${colors.bright}      .---.         .---.
     /     \\  _ _  /     \\
     \\_..-.-'\` _ \`'-.-.._/
       /  (  o   o  )  \\
       |   \`-.-.-\'\`   |
     _ \\     '-'     / _
    ( \\ \\  Meet your/ / )
     \\ \\ \\  Lobster \\/ /
      \\ \\/    FSD    \\/ ${colors.reset}
`;

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function runOnboarding() {
    console.log(LOBSTER_BANNER);
    console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);
    console.log(`${colors.bright}          Welcome to Full-Self-Developing (FSD)      ${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

    console.log(`${colors.green}▸ Check prerequisites...${colors.reset}`);
    
    // Check Node version
    const nodeVer = process.version;
    const majorVer = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
    if (majorVer >= 18) {
        console.log(`  ${colors.green}✓${colors.reset} Node.js version: ${nodeVer} (Supported)`);
    } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} Node.js version: ${nodeVer} (Recommended >= v18)`);
    }

    // Check Git
    try {
        const gitVer = execSync('git --version', { stdio: 'pipe' }).toString().trim();
        console.log(`  ${colors.green}✓${colors.reset} Git installed: ${gitVer}`);
    } catch (e) {
        console.log(`  ${colors.red}✗${colors.reset} Git was not detected in PATH. Git is required for autonomous operations.`);
    }

    console.log(`\n${colors.cyan}▸ Configuration Settings:${colors.reset}`);

    const settings = engineConfig.loadSettings();

    // 1. OpenRouter API Key
    const existingKey = process.env.OPENROUTER_API_KEY || (settings.ai && settings.ai.apiKey) || '';
    const maskedKey = existingKey ? existingKey.slice(0, 8) + '...' + existingKey.slice(-4) : 'None';
    
    console.log(`  Current API Key: ${colors.yellow}${maskedKey}${colors.reset}`);
    const newKey = await askQuestion(`  Enter your OpenRouter API Key (press Enter to keep current): `);
    
    if (newKey) {
        if (!settings.ai) settings.ai = {};
        settings.ai.apiKey = newKey;
        settings.ai.provider = 'OpenRouter';
        settings.ai.executionMode = 'HTTP API';
        console.log(`  ${colors.green}✓ API Key updated.${colors.reset}`);
    }

    // 2. Default Workspace Path
    const existingWorkspace = engineConfig.getWorkspacePath() || 'None';
    console.log(`\n  Current Workspace Path: ${colors.yellow}${existingWorkspace}${colors.reset}`);
    const newWorkspace = await askQuestion(`  Enter absolute path to your target project folder (press Enter to keep current): `);

    if (newWorkspace) {
        const absolutePath = path.resolve(newWorkspace);
        if (fs.existsSync(absolutePath)) {
            engineConfig.setWorkspacePath(absolutePath);
            console.log(`  ${colors.green}✓ Workspace set to: ${absolutePath}${colors.reset}`);
        } else {
            console.log(`  ${colors.red}⚠ Path does not exist. Workspace path remains unchanged.${colors.reset}`);
        }
    }

    // Save final settings
    engineConfig.saveSettings(settings);

    console.log(`\n${colors.green}✔ Onboarding completed successfully!${colors.reset}`);
    console.log(`  Configuration saved to: ${colors.cyan}${path.join(require('os').homedir(), '.fsd', '.engine', 'engine-config.json')}${colors.reset}\n`);

    const startNow = await askQuestion(`Would you like to start FSD right now? (y/N): `);
    if (startNow.toLowerCase() === 'y' || startNow.toLowerCase() === 'yes') {
        console.log(`\n${colors.green}🚀 Launching FSD...${colors.reset}`);
        startApp();
    } else {
        console.log(`\nYou can start FSD anytime by running: ${colors.bright}${colors.cyan}fsd${colors.reset} or ${colors.bright}${colors.cyan}fsd start${colors.reset}\n`);
    }
}

function startApp() {
    console.log(`${colors.cyan}[System] Starting secure loopback local API Server...${colors.reset}`);
    
    // Boot server and browser launcher in parallel
    require('../server.js');
    require('../launcher.js');
}

function showHelp() {
    console.log(`
${colors.bright}Usage:${colors.reset} fsd <command>

${colors.bright}Commands:${colors.reset}
  ${colors.cyan}onboard${colors.reset}    Run the interactive setup helper to configure keys and workspace.
  ${colors.cyan}start${colors.reset}      Start the API server and launch the desktop client application.
  ${colors.cyan}help${colors.reset}       Show this help information.

${colors.bright}Defaults:${colors.reset}
  Running ${colors.cyan}fsd${colors.reset} without arguments will launch the application directly.
`);
}

// CLI entry point logic
const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : 'start';

switch (command) {
    case 'onboard':
        runOnboarding();
        break;
    case 'start':
        startApp();
        break;
    case 'help':
    case '-h':
    case '--help':
        showHelp();
        break;
    default:
        console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
        showHelp();
        break;
}
