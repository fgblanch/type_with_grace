// Global variables for AI sessions
let session_corrector = null;
let session_predictor = null;
let isEnabled = true; // Default to enabled

// Style for the suggestion overlay
const style = document.createElement('style');
style.textContent = `
.turbotype-suggestion {
    position: absolute;
    background: #f0f0f0;
    border: 1px solid #ccc;
    padding: 2px 8px;
    border-radius: 4px;
    color: #666;
    font-style: italic;
    pointer-events: none;
    z-index: 10000;
}`;
document.head.appendChild(style);

// Function to correct typing mistakes
async function correctTypingMistakes(text) {
    try {
        if (!session_corrector) {
            return text;
        }
        const result = await session_corrector.prompt("Sequence: " + text);
        console.log('Corrected text:', result);
        return result;
    } catch (error) {
        console.error('Error correcting text:', error);
        return text;
    }
}

// Function to predict next words
async function predictNextWord(currentText) {
    try {
        if (!session_predictor) {
            return "suggestion";
        }
        const result = await session_predictor.prompt("Sequence: " + currentText);
        console.log('Predicted next word:', result);
        return result;
    } catch (error) {
        console.error('Error predicting next word:', error);
        return "suggestion";
    }
}

// Function to create or update suggestion overlay
function showSuggestion(inputElement, suggestion) {
    let suggestionEl = inputElement.nextElementSibling;
    
    if (!suggestionEl || !suggestionEl.classList.contains('turbotype-suggestion')) {
        suggestionEl = document.createElement('div');
        suggestionEl.classList.add('turbotype-suggestion');
        inputElement.parentNode.insertBefore(suggestionEl, inputElement.nextSibling);
    }

    const inputRect = inputElement.getBoundingClientRect();
    const inputStyle = window.getComputedStyle(inputElement);
    const textWidth = getTextWidth(inputElement.value, inputStyle.font);

    suggestionEl.style.top = `${inputRect.top}px`;
    suggestionEl.style.left = `${inputRect.left + textWidth + 5}px`;
    suggestionEl.style.font = inputStyle.font;
    suggestionEl.textContent = suggestion;
}

// Helper function to calculate text width
function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    context.font = font;
    return context.measureText(text).width;
}

// Function to handle input changes
async function handleInput(event) {
    if (!isEnabled) return; // Skip if disabled
    
    try {
        const element = event.target;
        const text = element.value;
        
        // Correct typing mistakes in real-time
        const correctedText = await correctTypingMistakes(text);
        if (correctedText !== text) {
            element.value = correctedText;
        }

        // Show word prediction if we're at the end of a word or the input
        if (text.endsWith(' ') || text === '') {
            const suggestion = await predictNextWord(text);
            if (suggestion) {
                showSuggestion(element, suggestion);
            }
        }
    } catch (error) {
        console.error('Error handling input:', error);
    }
}

// Handle tab key to accept suggestions
function handleKeyDown(event) {
    if (!isEnabled) return; // Skip if disabled
    
    if (event.key === 'Tab') {
        const element = event.target;
        const suggestionEl = element.nextElementSibling;
        
        if (suggestionEl && suggestionEl.classList.contains('turbotype-suggestion')) {
            event.preventDefault();
            element.value += suggestionEl.textContent;
            suggestionEl.remove();
        }
    }
}

// Add input event listeners to all text input elements
function addInputListeners() {
    // Select all input elements and textareas
    const inputElements = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
    
    inputElements.forEach(element => {
        element.addEventListener('input', handleInput);
        element.addEventListener('keydown', handleKeyDown);
    });
    
    // Create a MutationObserver to watch for dynamically added input elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    const inputs = node.querySelectorAll('input[type="text"], input[type="search"], textarea');
                    inputs.forEach(input => {
                        input.addEventListener('input', handleInput);
                        input.addEventListener('keydown', handleKeyDown);
                    });
                }
            });
        });
    });

    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleExtension') {
        isEnabled = message.enabled;
        if (!isEnabled) {
            // Remove all existing suggestions when disabled
            document.querySelectorAll('.turbotype-suggestion').forEach(el => el.remove());
        }
    }
});

// Initialize the extension with async support
(async () => {
    try {
        // Load initial state
        const result = await chrome.storage.local.get(['enabled']);
        isEnabled = result.enabled !== false; // Default to true if not set
        
        // Initialize listeners
        addInputListeners();
        
        // Start by checking if it's possible to create a session
        const {available, defaultTemperature, defaultTopK, maxTopK } = await ai.languageModel.capabilities();

        if (available !== "no") {
            // Initialize the extension
            addInputListeners();
  
            session_corrector = await ai.languageModel.create({
                monitor(m) {
                    m.addEventListener("downloadprogress", e => {
                        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
                    });
                },
                systemPrompt: "You are a spelling corrector system. I give you a sequence of inputs and you return the corrected sequence. Please only return the corrected sequence and nothing else."
            });

            session_predictor = await ai.languageModel.create({
                monitor(m) {
                    m.addEventListener("downloadprogress", e => {
                        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
                    });
                },
                systemPrompt: "You are a writing assistant system. I give you a sequence of text and you return the predicted next word. Please only return the predicted next word and nothing else."
            });
          
        } else {
            console.log("Gemini Nano not available. Turbotyping is not available.");
        }
        
        console.log('Turbotype initialized successfully');
    } catch (error) {
        console.error('Error initializing Turbotype:', error);
    }
})();
