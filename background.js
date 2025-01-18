let connections = new Set();
let contentScriptPorts = new Set();

// Handle connection from side panel
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'sidepanel') {
        connections.add(port);
        
        port.onDisconnect.addListener(function() {
            connections.delete(port);
        });
    } else if (port.name === 'content-script') {
        contentScriptPorts.add(port);
        
        port.onDisconnect.addListener(function() {
            contentScriptPorts.delete(port);
        });
    }
});

// Set up side panel behavior
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.type === 'PING') {
            sendResponse({ status: 'alive' });
        } else if (request.type === 'SELECTED_TEXT') {
            for (let port of connections) {
                port.postMessage({
                    type: 'ADD_TEXT_BUBBLE',
                    text: request.text
                });
            }
            sendResponse({ status: 'success' });
        } else if (request.type === 'CAPTURE_SCREENSHOT') {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                for (let port of connections) {
                    port.postMessage({
                        type: 'ADD_SCREENSHOT_BUBBLE',
                        imageData: dataUrl,
                        area: request.area
                    });
                }
                sendResponse({ status: 'success' });
            });
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        sendResponse({ status: 'error', message: error.message });
    }
    return true; // Indicate async response
});

// Periodic check of content script connections
setInterval(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_CONNECTION' })
                .catch(() => {
                    // If content script doesn't respond, it might need reinjection
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    }).catch(console.error);
                });
        }
    });
}, 60000); // Check every minute