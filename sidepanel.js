const bubbleContainer = document.getElementById('bubbleContainer');
const settingsButton = document.querySelector('.settings-button');
const settingsPanel = document.getElementById('settingsPanel');
const searchBox = document.querySelector('.search-box');
const bgColorPicker = document.getElementById('bgColor');
const bubbleColorPicker = document.getElementById('bubbleColor');
const textColorPicker = document.getElementById('textColor');
let port;
let settings = {
    backgroundColor: '#292a2d',
    bubbleColor: '#3c4043',
    textColor: '#ffffff'
};

// Settings Panel Toggle
settingsButton.addEventListener('click', () => {
    settingsPanel.classList.toggle('show');
    settingsButton.classList.toggle('active');
});

// Search functionality
searchBox.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const bubbles = document.querySelectorAll('.text-bubble');
    
    bubbles.forEach(bubble => {
        const textarea = bubble.querySelector('textarea');
        const text = textarea.value.toLowerCase();
        
        if (searchTerm === '') {
            bubble.style.display = 'block';
            bubble.style.animation = 'fadeIn 0.3s ease-in-out';
            // Clear highlight
            textarea.style.display = 'block';
            const highlightDiv = bubble.querySelector('.search-highlight');
            if (highlightDiv) {
                highlightDiv.remove();
            }
        } else {
            const hasMatch = text.includes(searchTerm);
            if (hasMatch) {
                bubble.style.display = 'block';
                bubble.style.animation = 'fadeIn 0.3s ease-in-out';
                highlightSearchTerm(bubble, searchTerm);
            } else {
                bubble.style.display = 'none';
            }
        }
    });
});

function highlightSearchTerm(bubble, searchTerm) {
    const textarea = bubble.querySelector('textarea');
    const text = textarea.value;
    
    // Remove existing highlight div if exists
    let highlightDiv = bubble.querySelector('.search-highlight');
    if (highlightDiv) {
        highlightDiv.remove();
    }
    
    if (searchTerm === '') {
        textarea.style.display = 'block';
        return;
    }
    
    // Create new highlight div
    highlightDiv = document.createElement('div');
    highlightDiv.className = 'search-highlight';
    
    // Show highlighted text
    const highlightedText = text.replace(new RegExp(searchTerm, 'gi'), match => 
        `<mark class="highlight">${match}</mark>`
    );
    highlightDiv.innerHTML = highlightedText;
    highlightDiv.style.display = 'block';
    textarea.style.display = 'none';
    
    bubble.insertBefore(highlightDiv, textarea);
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        if (result.settings) {
            settings = result.settings;
            applySettings();
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Save settings to storage
async function saveSettings() {
    try {
        await chrome.storage.sync.set({ settings });
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// Apply settings to UI
function applySettings() {
    document.documentElement.style.setProperty('--background-color', settings.backgroundColor);
    document.documentElement.style.setProperty('--bubble-color', settings.bubbleColor);
    document.documentElement.style.setProperty('--text-color', settings.textColor);
    
    bgColorPicker.value = settings.backgroundColor;
    bubbleColorPicker.value = settings.bubbleColor;
    textColorPicker.value = settings.textColor;
}

// Settings event listeners
bgColorPicker.addEventListener('change', (e) => {
    settings.backgroundColor = e.target.value;
    applySettings();
    saveSettings();
});

bubbleColorPicker.addEventListener('change', (e) => {
    settings.bubbleColor = e.target.value;
    applySettings();
    saveSettings();
});

textColorPicker.addEventListener('change', (e) => {
    settings.textColor = e.target.value;
    applySettings();
    saveSettings();
});

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
}

// Load and save bubbles
async function saveBubbles() {
    const bubbles = [];
    document.querySelectorAll('.text-bubble').forEach(bubble => {
        bubbles.push({
            type: 'text',
            content: bubble.querySelector('textarea').value
        });
    });
    
    try {
        await chrome.storage.local.set({ bubbles });
    } catch (error) {
        console.error('Failed to save bubbles:', error);
    }
}

async function loadBubbles() {
    try {
        const result = await chrome.storage.local.get('bubbles');
        bubbleContainer.innerHTML = '';
        
        if (result.bubbles) {
            result.bubbles.reverse().forEach(bubble => {
                if (bubble.type === 'text') {
                    createTextBubble(bubble.content);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load bubbles:', error);
    }
}

function connectToBackground() {
    try {
        port = chrome.runtime.connect({ name: 'sidepanel' });
        
        port.onMessage.addListener((message) => {
            if (message.type === 'ADD_TEXT_BUBBLE') {
                createTextBubble(message.text);
            }
        });

        port.onDisconnect.addListener(() => {
            setTimeout(connectToBackground, 1000);
        });
    } catch (error) {
        console.error('Connection failed:', error);
        setTimeout(connectToBackground, 1000);
    }
}

function addDragListeners(bubble) {
    bubble.draggable = true;
    
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    bubble.appendChild(dragHandle);

    bubble.addEventListener('dragstart', (e) => {
        bubble.classList.add('bubble-dragging');
        e.dataTransfer.setData('text/plain', bubble.dataset.bubbleId);
        e.dataTransfer.effectAllowed = 'move';
    });

    bubble.addEventListener('dragend', () => {
        bubble.classList.remove('bubble-dragging');
        document.querySelectorAll('.text-bubble').forEach(b => {
            b.classList.remove('bubble-drag-over');
        });
    });

    bubble.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingBubble = document.querySelector('.bubble-dragging');
        if (draggingBubble !== bubble) {
            bubble.classList.add('bubble-drag-over');
        }
    });

    bubble.addEventListener('dragleave', () => {
        bubble.classList.remove('bubble-drag-over');
    });

    bubble.addEventListener('drop', (e) => {
        e.preventDefault();
        bubble.classList.remove('bubble-drag-over');
        
        const draggedBubbleId = e.dataTransfer.getData('text/plain');
        const draggedBubble = document.querySelector(`[data-bubble-id="${draggedBubbleId}"]`);
        
        if (draggedBubble && draggedBubble !== bubble) {
            const rect = bubble.getBoundingClientRect();
            const dropY = e.clientY;
            const bubbleMiddleY = rect.top + rect.height / 2;
            
            if (dropY < bubbleMiddleY) {
                bubble.parentNode.insertBefore(draggedBubble, bubble);
            } else {
                bubble.parentNode.insertBefore(draggedBubble, bubble.nextSibling);
            }
            saveBubbles();
        }
    });
}

let bubbleCounter = 0;

function createTextBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'text-bubble';
    bubble.dataset.bubbleId = `bubble-${bubbleCounter++}`;
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.spellcheck = false;
    textarea.addEventListener('input', function() {
        adjustTextareaHeight(this);
        saveBubbles();
        // Reset search if active
        if (searchBox.value.trim()) {
            searchBox.dispatchEvent(new Event('input'));
        }
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '<i class="fas fa-times"></i>';
    deleteButton.title = 'Delete';
    deleteButton.addEventListener('click', () => {
        bubble.remove();
        saveBubbles();
    });

    bubble.appendChild(textarea);
    bubble.appendChild(deleteButton);
    addDragListeners(bubble);
    bubbleContainer.prepend(bubble);

    // Set initial height after appending
    requestAnimationFrame(() => {
        adjustTextareaHeight(textarea);
    });
    saveBubbles();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadBubbles();
    connectToBackground();
});