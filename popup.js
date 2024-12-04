document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleExtension');

    // Load the current state
    chrome.storage.local.get(['enabled'], function(result) {
        toggleSwitch.checked = result.enabled !== false; // Default to true if not set
    });

    // Handle toggle changes
    toggleSwitch.addEventListener('change', function() {
        const enabled = toggleSwitch.checked;
        
        // Save the state
        chrome.storage.local.set({ enabled: enabled });

        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleExtension',
                enabled: enabled
            });
        });
    });
});
