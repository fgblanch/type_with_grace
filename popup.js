document.addEventListener('DOMContentLoaded', function() {
    const toggleAutocorrect = document.getElementById('toggleAutocorrect');

    // Load the current states
    chrome.storage.local.get(['autocorrectEnabled'], function(result) {        
        toggleAutocorrect.checked = result.autocorrectEnabled !== false; // Default to true if not set
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
                autocorrectEnabled: toggleAutocorrect.checked
            });
        });
    }
});
