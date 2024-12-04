// Global variables for AI sessions
let session_corrector = null;
let session_predictor = null;
let suggestionsEnabled = true; // Default to enabled
let autocorrectEnabled = true; // Default to enabled
let correctionTimeout = null; // For debouncing corrections

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
        const prompt = "sequence: " + text;
        const result = await session_corrector.prompt(prompt);
        console.log('Prompt:', prompt, 'Result:', result);
        console.log(`${session_corrector.tokensSoFar}/${session_corrector.maxTokens} (${session_corrector.tokensLeft} left)`);
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
        const result = await session_predictor.prompt("sequence: " + currentText);
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

// Function to check if we should skip the correction
function shouldSkipCorrection(event, text) {
    //Windows:  Check for Ctrl+Z (undo)
    if (event.ctrlKey && event.key === 'z') {
        return true;
    }

    //Mac:  Check for Command+Z (undo)
    if (event.metaKey && event.key === 'z') {
        return true;
    }

    //Check for backspace key
    if (event.key === 'Backspace') {
        return true;
    }

    // Get the last character typed
    const lastChar = text.charAt(text.length - 1);
    
    // Skip if the last character is:
    // - a space
    // - a newline
    // - empty (which could indicate backspace)
    return lastChar === ' ' || 
           lastChar === '\n' ||
           lastChar === '\t' || 
           lastChar === '';
}

// Function to handle input changes
async function handleInput(event) {
    const input = event.target;
    const text = input.value;
    const cursorPosition = input.selectionStart;

    // Only perform autocorrect if enabled
    if (autocorrectEnabled && !shouldSkipCorrection(event, text)) {
        // Clear any pending correction
        if (correctionTimeout) {
            clearTimeout(correctionTimeout);
        }

        // Set a new timeout for correction
        // This allows the user to finish typing before the correction is applied.
        correctionTimeout = setTimeout(async () => {
            // Get correction for the full text
            const correctedText = await correctTypingMistakes(text);
            if (correctedText !== text) {
                input.value = correctedText;
                //input.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 300); 
    }
}

// Function to handle tab key to accept suggestions
function handleKeyDown(event) {
    if (event.key === 'Tab' && suggestionsEnabled) {
        const element = event.target;
        const suggestion = document.querySelector('.turbotype-suggestion');
        
        if (suggestion) {
            event.preventDefault();
            element.value += suggestion.textContent;
            suggestion.remove();
        }
    }
}

// Add input event listeners to all text input elements
function addInputListeners() {
    // Select all input elements and textareas
    const inputElements = document.querySelectorAll('input[type="text"],textarea');
    
    inputElements.forEach(element => {
        element.addEventListener('input', handleInput);
        //element.addEventListener('keydown', handleKeyDown);
    });
    
    // Create a MutationObserver to watch for dynamically added input elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    const inputs = node.querySelectorAll('input[type="text"], textarea');
                    inputs.forEach(input => {
                        input.addEventListener('input', handleInput);
                        // This event listener is only used for the suggestions feature
                        //input.addEventListener('keydown', handleKeyDown);
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
    if (message.action === 'updateSettings') {
        suggestionsEnabled = message.suggestionsEnabled;
        autocorrectEnabled = message.autocorrectEnabled;
    }
});

// Initialize the extension with async support
(async () => {
    try {
        
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
                systemPrompt: "You are a spelling corrector system. I give you a text sequence and you return the corrected sequence. Only correct wrong spellings. Do not remove any words. Do not add any words. Only correct the last sentence. Please do not provide any explanation. Please only return the corrected sequence and nothing else. Please do not include a period at the end. Please do not include a new line at the end."
            });

            /*session_predictor = await ai.languageModel.create({
                monitor(m) {
                    m.addEventListener("downloadprogress", e => {
                        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
                    });
                },
                systemPrompt: "You are a writing assistant system. I give you a text sequence and you return the predicted next word. Please only return the predicted next word and nothing else."
            });*/
          
        } else {
            console.log("Gemini Nano not available. Turbotyping is not available.");
        }
        
        console.log('Turbotype initialized successfully');
    } catch (error) {
        console.error('Error initializing Turbotype:', error);
    }
})();
