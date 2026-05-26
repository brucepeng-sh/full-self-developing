// background.js
let ws = null;
let isConnected = false;
let currentPort = 9223;

// Load port from storage
chrome.storage.local.get(['relayPort'], (result) => {
  if (result.relayPort) {
    currentPort = result.relayPort;
  }
  connect();
});

// Alarm to keep Service Worker alive and trigger reconnects if down
chrome.alarms.create('fsd-heartbeat', { periodInMinutes: 0.15 }); // ~10 seconds
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fsd-heartbeat') {
    if (!isConnected) {
      console.log('Heartbeat check: reconnecting...');
      connect();
    } else if (ws && ws.readyState === WebSocket.OPEN) {
      // Send a ping to keep WebSocket connection active
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }
});

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  console.log(`Connecting to FSD Browser Relay on ws://127.0.0.1:${currentPort}...`);
  ws = new WebSocket(`ws://127.0.0.1:${currentPort}`);

  ws.onopen = () => {
    isConnected = true;
    console.log('Connected to FSD Browser Relay successfully.');
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'ping') {
        return;
      }
      
      const { id, action, params } = data;
      if (!id || !action) return;

      console.log(`Received command: ${action}`, params);
      
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab && action !== 'browser_navigate') {
        throw new Error('No active browser tab found. Please open a website tab first.');
      }

      let result;
      switch (action) {
        case 'browser_navigate':
          result = await handleNavigate(params.url, tab);
          break;
        case 'browser_click':
          result = await handleExecuteScript(tab.id, (selector) => {
            const el = document.querySelector(selector);
            if (!el) return { success: false, error: 'Element not found for selector: ' + selector };
            el.click();
            return { success: true };
          }, [params.selector]);
          break;
        case 'browser_type':
          result = await handleExecuteScript(tab.id, (selector, text) => {
            const el = document.querySelector(selector);
            if (!el) return { success: false, error: 'Element not found for selector: ' + selector };
            
            // Set input value
            el.value = text;
            // Dispatch input/change events to trigger framework updates
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          }, [params.selector, params.text]);
          break;
        case 'browser_get_html':
          result = await handleExecuteScript(tab.id, () => {
            return { html: document.documentElement.outerHTML };
          }, []);
          break;
        case 'browser_screenshot':
          result = await handleScreenshot(tab.windowId);
          break;
        case 'browser_evaluate':
          result = await handleExecuteScript(tab.id, (code) => {
            try {
              // Safe evaluation context in tab
              const fn = new Function(code);
              const val = fn();
              return { success: true, value: val };
            } catch (err) {
              return { success: false, error: err.message };
            }
          }, [params.code]);
          break;
        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      ws.send(JSON.stringify({ id, success: true, result }));
    } catch (err) {
      console.error('Error handling command:', err);
      // Try to extract ID if present
      let reqId = null;
      try {
        const data = JSON.parse(event.data);
        reqId = data.id;
      } catch(_) {}
      
      if (reqId) {
        ws.send(JSON.stringify({ id: reqId, success: false, error: err.message }));
      }
    }
  };

  ws.onclose = () => {
    isConnected = false;
    console.log('FSD Browser Relay connection closed.');
  };

  ws.onerror = (err) => {
    isConnected = false;
    console.error('FSD Browser Relay connection error:', err);
  };
}

// Action Handlers
async function handleNavigate(url, activeTab) {
  // Ensure protocol
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  if (activeTab) {
    await chrome.tabs.update(activeTab.id, { url });
    // Wait slightly for load trigger
    await new Promise(r => setTimeout(r, 1000));
    return { url, message: 'Navigation started' };
  } else {
    const tab = await chrome.tabs.create({ url });
    await new Promise(r => setTimeout(r, 1000));
    return { url, message: 'New tab created' };
  }
}

async function handleExecuteScript(tabId, func, args) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: func,
    args: args
  });
  
  if (results && results[0]) {
    const res = results[0].result;
    if (res && res.success === false) {
      throw new Error(res.error || 'Execution failed inside tab');
    }
    return res;
  }
  throw new Error('Failed to execute script on active tab');
}

async function handleScreenshot(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Return base64 without prefix data:image/png;base64,
        const base64 = dataUrl.split(',')[1];
        resolve({ base64 });
      }
    });
  });
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_STATUS') {
    sendResponse({ connected: isConnected, port: currentPort });
  } else if (request.type === 'RECONNECT') {
    currentPort = request.port;
    if (ws) {
      ws.close();
    }
    connect();
    sendResponse({ success: true });
  }
  return true;
});
