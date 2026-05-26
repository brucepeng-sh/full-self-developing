// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const portInput = document.getElementById('port-input');
  const saveBtn = document.getElementById('save-btn');

  // Load saved port
  chrome.storage.local.get(['relayPort'], (result) => {
    if (result.relayPort) {
      portInput.value = result.relayPort;
    }
  });

  // Query background for current state
  function updateUI() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      if (response) {
        if (response.connected) {
          statusDot.className = 'dot connected';
          statusText.textContent = '已连接';
        } else {
          statusDot.className = 'dot';
          statusText.textContent = '未连接';
        }
      }
    });
  }

  // Initial update
  updateUI();
  
  // Poll connection state every 1s
  const interval = setInterval(updateUI, 1000);

  saveBtn.addEventListener('click', () => {
    const port = parseInt(portInput.value, 10);
    if (port && port >= 1024 && port <= 65535) {
      chrome.storage.local.set({ relayPort: port }, () => {
        chrome.runtime.sendMessage({ type: 'RECONNECT', port }, (response) => {
          updateUI();
        });
      });
    } else {
      alert('请输入有效的端口号 (1024-65535)');
    }
  });

  window.addEventListener('unload', () => {
    clearInterval(interval);
  });
});
