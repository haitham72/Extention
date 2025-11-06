// background.js
console.log('YouTube Summarizer: background ready');

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the URL is a YouTube watch page and the tab has finished loading
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    
    // Send a message to the content script in that tab
    chrome.tabs.sendMessage(tabId, {
      type: 'YOUTUBE_URL_CHANGED',
      videoId: new URL(tab.url).searchParams.get('v')
    }, (response) => {
      // === THIS IS THE FIX ===
      // Catch the error if the content script isn't listening yet.
      // This is expected on the *first* page load, as the content
      // script will initialize itself.
      if (chrome.runtime.lastError) {
        console.log('Content script not ready yet, initial load will handle.');
      } else {
        // Optional: Log if the message was received successfully
        console.log('Message received by content script:', response?.status);
      }
      // === END OF FIX ===
    });
  }
});