const bubbleContainer = document.getElementById('bubbleContainer');
const settingsButton = document.querySelector('.settings-button');
const settingsPanel = document.getElementById('settingsPanel');
const bgColorPicker = document.getElementById('bgColor');
const bubbleColorPicker = document.getElementById('bubbleColor');
const textColorPicker = document.getElementById('textColor');
const importButton = document.querySelector('.import-button');

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

// Import functionality
importButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (importedData.bubbles) {
                        await chrome.storage.local.set({ bubbles: importedData.bubbles });
                        loadBubbles();
                    }
                } catch (error) {
                    console.error('Failed to import notes:', error);
                    // You might want to add user feedback here
                }
            };
            reader.readAsText(file);
        }
    };
    
    input.click();
});

// Load and save bubbles
async function saveBubbles() {
    const bubbles = [];
    document.querySelectorAll('.text-bubble, .screenshot-bubble').forEach(bubble => {
        if (bubble.classList.contains('text-bubble')) {
            bubbles.push({
                type: 'text',
                content: bubble.querySelector('textarea').value
            });
        } else {
            bubbles.push({
                type: 'screenshot',
                content: bubble.querySelector('canvas').toDataURL()
            });
        }
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
        // Clear existing bubbles before loading
        bubbleContainer.innerHTML = '';
        
        if (result.bubbles) {
            result.bubbles.reverse().forEach(bubble => {
                if (bubble.type === 'text') {
                    createTextBubble(bubble.content);
                } else {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        createScreenshotBubble(canvas);
                    };
                    img.src = bubble.content;
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
            } else if (message.type === 'ADD_SCREENSHOT_BUBBLE') {
                createScreenshotBubble(message.imageData, message.area);
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

function createTextBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'text-bubble';
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.spellcheck = false;
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
        saveBubbles();
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
    bubbleContainer.prepend(bubble);

    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    saveBubbles();
}

function createScreenshotBubble(imageData, area) {
    const bubble = document.createElement('div');
    bubble.className = 'screenshot-bubble';
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (imageData instanceof HTMLCanvasElement) {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.drawImage(imageData, 0, 0);
    } else {
        const img = new Image();
        img.onload = () => {
            canvas.width = area.width;
            canvas.height = area.height;
            ctx.drawImage(
                img,
                area.x, area.y, area.width, area.height,
                0, 0, area.width, area.height
            );
            saveBubbles();
        };
        img.src = imageData;
    }
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '<i class="fas fa-times"></i>';
    deleteButton.title = 'Delete';
    deleteButton.addEventListener('click', () => {
        bubble.remove();
        saveBubbles();
    });

    bubble.appendChild(canvas);
    bubble.appendChild(deleteButton);
    bubbleContainer.prepend(bubble);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadBubbles();
    connectToBackground();
});