let extensionActive = true;

function isExtensionValid() {
    try {
        return chrome.runtime && !!chrome.runtime.id;
    } catch {
        return false;
    }
}

async function handleTextSelection() {
    if (!isExtensionValid()) return;

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        try {
            await chrome.runtime.sendMessage({
                type: 'SELECTED_TEXT',
                text: selectedText
            });
        } catch (error) {
            if (!error.message.includes('Extension context invalidated')) {
                console.error('Text selection failed:', error);
            }
        }
    }
}

async function handleMouseUp(e) {
    if (!isExtensionValid()) return;
    await handleTextSelection();
}

function removeListeners() {
    document.removeEventListener('mouseup', handleMouseUp);
}

function setupListeners() {
    removeListeners();
    document.addEventListener('mouseup', handleMouseUp);
}

function init() {
    if (isExtensionValid()) {
        setupListeners();
    }
}

// Initialize
init();

// Handle extension messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionValid()) return;

    if (message.type === 'CHECK_CONNECTION') {
        sendResponse({ status: 'connected' });
    }
    return true;
});