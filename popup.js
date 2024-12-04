document.addEventListener('DOMContentLoaded', function() {
    const toggleSuggestions = document.getElementById('toggleSuggestions');
    const toggleAutocorrect = document.getElementById('toggleAutocorrect');

    // Load the current states
    chrome.storage.local.get(['suggestionsEnabled', 'autocorrectEnabled'], function(result) {
        toggleSuggestions.checked = result.suggestionsEnabled !== false; // Default to true if not set
        toggleAutocorrect.checked = result.autocorrectEnabled !== false; // Default to true if not set
    });

    // Handle suggestions toggle changes
    toggleSuggestions.addEventListener('change', function() {
        const suggestionsEnabled = toggleSuggestions.checked;
        chrome.storage.local.set({ suggestionsEnabled: suggestionsEnabled });
        sendMessageToContentScript();
    });

    // Handle autocorrect toggle changes
    toggleAutocorrect.addEventListener('change', function() {
        const autocorrectEnabled = toggleAutocorrect.checked;
        chrome.storage.local.set({ autocorrectEnabled: autocorrectEnabled });
        sendMessageToContentScript();
    });

    // Function to send current state to content script
    function sendMessageToContentScript() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'updateSettings',
                suggestionsEnabled: toggleSuggestions.checked,
                autocorrectEnabled: toggleAutocorrect.checked
            });
        });
    }
});
