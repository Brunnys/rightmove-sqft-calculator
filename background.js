chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchImage") {
      fetch(request.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => sendResponse({ dataUrl: reader.result });
          reader.readAsDataURL(blob);
        })
        .catch(error => sendResponse({ error: error.message }));
      return true; // Indicates an asynchronous response
    }
  });

  console.log('Background script loaded');