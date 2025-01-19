let connections = new Set();

chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'sidepanel') {
        connections.add(port);
        port.onDisconnect.addListener(function() {
            connections.delete(port);
        });
    }
});

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SELECTED_TEXT') {
        for (let port of connections) {
            port.postMessage({
                type: 'ADD_TEXT_BUBBLE',
                text: request.text
            });
        }
        sendResponse({ status: 'success' });
    }
    return true;
});

// Check if content script needs injection
async function checkContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { type: 'CHECK_CONNECTION' });
        return true;
    } catch {
        return false;
    }
}

// Inject content script if needed
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        return true;
    } catch (error) {
        console.error('Content script injection failed:', error);
        return false;
    }
}

// Periodic content script check
setInterval(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        const hasContentScript = await checkContentScript(tabs[0].id);
        if (!hasContentScript) {
            await injectContentScript(tabs[0].id);
        }
    }
}, 60000);