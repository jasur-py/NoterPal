let isSelecting = false;
let selectionBox = null;
let startX, startY;
let extensionActive = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // 1 second

function checkExtensionConnection() {
    try {
        // Ping the background script to check connection
        chrome.runtime.sendMessage({ type: 'PING' }, response => {
            if (chrome.runtime.lastError) {
                handleConnectionError();
            } else {
                extensionActive = true;
                reconnectAttempts = 0;
            }
        });
    } catch (error) {
        handleConnectionError();
    }
}

function handleConnectionError() {
    extensionActive = false;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
            initializeContentScript();
        }, RECONNECT_DELAY * reconnectAttempts);
    }
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function handleTextSelection() {
    if (!extensionActive) return;

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        try {
            await sendMessage({
                type: 'SELECTED_TEXT',
                text: selectedText
            });
        } catch (error) {
            handleConnectionError();
            console.error('Failed to send selection:', error);
        }
    }
}

function createSelectionBox() {
    if (selectionBox) selectionBox.remove();
    selectionBox = document.createElement('div');
    selectionBox.style.position = 'fixed';
    selectionBox.style.border = '2px solid #4285f4';
    selectionBox.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = '10000';
    document.body.appendChild(selectionBox);
}

function updateSelectionBox(e) {
    if (!selectionBox) return;
    const width = e.pageX - startX;
    const height = e.pageY - startY;
    
    selectionBox.style.left = width < 0 ? `${e.pageX}px` : `${startX}px`;
    selectionBox.style.top = height < 0 ? `${e.pageY}px` : `${startY}px`;
    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
}

async function captureScreenshot() {
    if (!extensionActive || !selectionBox) return;
    
    const rect = selectionBox.getBoundingClientRect();
    try {
        await sendMessage({
            type: 'CAPTURE_SCREENSHOT',
            area: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            }
        });
    } catch (error) {
        handleConnectionError();
        console.error('Failed to capture screenshot:', error);
    }
}

function cleanup() {
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    isSelecting = false;
}

function initializeContentScript() {
    // Check extension connection on initialization
    checkExtensionConnection();

    // Set up event listeners
    function setupEventListeners() {
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('unload', cleanup);
    }

    function removeEventListeners() {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('unload', cleanup);
    }

    function handleMouseDown(e) {
        if (!extensionActive) return;
        if (e.altKey && e.shiftKey) {
            isSelecting = true;
            startX = e.pageX;
            startY = e.pageY;
            createSelectionBox();
            e.preventDefault();
        }
    }

    function handleMouseMove(e) {
        if (isSelecting) {
            updateSelectionBox(e);
        }
    }

    function handleMouseUp(e) {
        if (isSelecting) {
            captureScreenshot();
            cleanup();
        } else {
            handleTextSelection();
        }
    }

    // Remove existing listeners before adding new ones
    removeEventListeners();
    // Set up new listeners
    setupEventListeners();

    // Set up connection monitoring
    const port = chrome.runtime.connect({ name: 'content-script' });
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            handleConnectionError();
        }
    });

    // Periodic connection check
    setInterval(checkExtensionConnection, 30000); // Check every 30 seconds
}

// Initialize the content script
initializeContentScript();

// Listen for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_CONNECTION') {
        sendResponse({ status: 'connected' });
    }
    return true;
});