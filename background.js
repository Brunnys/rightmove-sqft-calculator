chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    if (request.action === "fetchImage") {
      fetch(request.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            console.log('Image fetched and converted to data URL');
            sendResponse({ dataUrl: reader.result });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error fetching image:', error);
          sendResponse({ error: error.message });
        });
      return true; // Indicates that the response is sent asynchronously
    }
  });

  console.log('Background script loaded');