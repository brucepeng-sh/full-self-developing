const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const bootConfPath = path.join(__dirname, '.boot-conf.json');

// Helper to wait until boot configuration is written by server.js
function waitForBootConf(retryCount = 0) {
    if (fs.existsSync(bootConfPath)) {
        try {
            const conf = JSON.parse(fs.readFileSync(bootConfPath, 'utf8'));
            launchBrowser(conf.port, conf.token);
        } catch (e) {
            console.error('Error parsing boot configuration:', e);
        }
    } else {
        if (retryCount < 30) {
            setTimeout(() => waitForBootConf(retryCount + 1), 500);
        } else {
            console.error('Timeout waiting for boot configuration from server.js');
        }
    }
}

// Find standard Chrome or Edge executable paths on Windows
function findBrowser() {
    const homeDir = process.env.USERPROFILE || 'C:\\Users\\Administrator';
    
    const possiblePaths = [
        // Google Chrome standard installation paths
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(homeDir, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
        
        // Microsoft Edge fallback paths
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(homeDir, 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe')
    ];

    for (const browserPath of possiblePaths) {
        if (fs.existsSync(browserPath)) {
            return browserPath;
        }
    }
    return null;
}

function launchBrowser(port, token) {
    const browserPath = findBrowser();
    if (!browserPath) {
        console.error('========================================================');
        console.error(' Error: Neither Google Chrome nor MS Edge was detected. ');
        console.error(' Please open this link in your standard web browser:    ');
        console.log(` http://127.0.0.1:${port}/?token=${token}            `);
        console.error('========================================================');
        return;
    }

    const targetUrl = `http://127.0.0.1:${port}/?token=${token}`;
    
    // Launch browser in dedicated, frameless standalone application window
    // and isolate user data directories so extension/cache remains local.
    const userProfileDir = path.join(__dirname, '.chrome-profile');
    
    const args = [
        `--app=${targetUrl}`,
        `--user-data-dir=${userProfileDir}`,
        '--no-first-run',
        '--no-default-browser-check'
    ];

    console.log(`[Launcher] Launching: ${browserPath}`);
    console.log(`[Launcher] App URL: ${targetUrl}`);

    const child = spawn(browserPath, args, {
        detached: true,
        stdio: 'ignore'
    });

    child.unref();
    
    // Delete boot configuration after launch to maintain token security
    setTimeout(() => {
        try {
            if (fs.existsSync(bootConfPath)) {
                fs.unlinkSync(bootConfPath);
            }
        } catch (err) {}
    }, 2000);
}

// Begin tracking
waitForBootConf();
