console.log('Content script starting...');

const CACHE_KEY = 'rightmoveOcrCache';

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function extractPrice() {
  try {
    const possiblePriceElements = document.querySelectorAll('*');
    for (const element of possiblePriceElements) {
      if (element.textContent.includes('£')) {
        const priceText = element.textContent.trim();
        const priceMatch = priceText.match(/£([\d,]+)/);
        if (priceMatch) {
          const price = priceMatch[0];
          console.log('Extracted price:', price);
          return price;
        }
      }
    }
    console.log('Price not found');
    return null;
  } catch (error) {
    console.error('Error extracting price:', error);
    return null;
  }
}

function findFloorplanUrl() {
  // Instead of searching for the image, look for the floorplan link
  const floorplanLink = document.querySelector('a[href*="#/floorplan"]');
  if (floorplanLink) {
    console.log('Found floorplan link:', floorplanLink.href);
    return floorplanLink.href;
  }
  console.log('No floorplan link found');
  return null;
}

// New function to perform OCR on the floorplan image
async function extractSquareFootage(floorplanUrl) {
  try {
    // Check cache first
    const cachedResult = await getCachedResult(floorplanUrl);
    if (cachedResult) {
      console.log('Using cached result for:', floorplanUrl);
      return cachedResult;
    }

    console.log('Fetching floorplan image:', floorplanUrl);
    
    // If we're not on the floorplan page, navigate to it
    if (!window.location.hash.includes('#/floorplan')) {
      console.log('Navigating to floorplan page...');
      window.location.href = floorplanUrl;
      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Now we should be on the floorplan page
    const floorplanImage = await retrySelector('img[src*="FLP_00"]', 5, 1000);
    if (!floorplanImage) {
      throw new Error('Floorplan image not found on page');
    }

    console.log('Found floorplan image:', floorplanImage.src);
    
    // Use the background script to fetch the image
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "fetchImage", url: floorplanImage.src }, resolve);
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const dataUrl = response.dataUrl;
    
    const worker = await Tesseract.createWorker('eng');
    const { data: { text } } = await worker.recognize(dataUrl);
    await worker.terminate();

    console.log('OCR result:', text);
    
    // Parse the OCR result to find square footage
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sq\s*m)/i);
    const squareFootage = match ? parseFloat(match[1]) : null;
    
    const result = { squareFootage, rawText: text };
    
    // Cache the result
    await cacheResult(floorplanUrl, result);
    
    return result;
  } catch (error) {
    console.error('Error in extractSquareFootage:', error);
    return { squareFootage: null, rawText: 'OCR failed: ' + error.message };
  }
}

async function retrySelector(selector, maxAttempts, delay) {
  for (let i = 0; i < maxAttempts; i++) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return null;
}

async function getCachedResult(url) {
  return new Promise(resolve => {
    chrome.storage.local.get(CACHE_KEY, (result) => {
      const cache = result[CACHE_KEY] || {};
      const cachedItem = cache[url];
      if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_EXPIRY) {
        resolve(cachedItem.data);
      } else {
        resolve(null);
      }
    });
  });
}

async function cacheResult(url, data) {
  return new Promise(resolve => {
    chrome.storage.local.get(CACHE_KEY, (result) => {
      const cache = result[CACHE_KEY] || {};
      cache[url] = { data, timestamp: Date.now() };
      chrome.storage.local.set({ [CACHE_KEY]: cache }, resolve);
    });
  });
}

// Main function to handle the calculation request
async function handleCalculateRequest() {
  try {
    const price = extractPrice();
    console.log('Extracted price:', price);

    const floorplanUrl = findFloorplanUrl();
    console.log('Found floorplan URL:', floorplanUrl);

    let squareFootage = null;
    let rawOcrText = null;
    if (floorplanUrl) {
      console.log('Attempting to extract square footage...');
      const result = await extractSquareFootage(floorplanUrl);
      squareFootage = result.squareFootage;
      rawOcrText = result.rawText;
    } else {
      console.log('No floorplan URL found, skipping square footage extraction');
    }

    const pricePerSqFt = price && squareFootage ? 
      (parseFloat(price.replace(/[£,]/g, '')) / squareFootage).toFixed(2) : 'N/A';

    const calculationResult = {
      price: price || 'Not found',
      squareFootage: squareFootage ? `${squareFootage} sq ft` : 'Not found',
      pricePerSqFt: pricePerSqFt !== 'N/A' ? `£${pricePerSqFt}` : 'N/A',
      timestamp: Date.now() // This should be a number representing milliseconds since epoch
    };

    // Store the result in chrome.storage.local
    chrome.storage.local.set({ 'lastCalculation': calculationResult }, () => {
      console.log('Calculation result stored');
    });

    return calculationResult;
  } catch (error) {
    console.error('Error in handleCalculateRequest:', error);
    throw error;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === "calculate") {
    handleCalculateRequest()
      .then(result => {
        console.log('Calculation result:', result);
        sendResponse({ result });
      })
      .catch(error => {
        console.error('Error in handleCalculateRequest:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates that the response is sent asynchronously
  }
});

console.log('Content script loaded and ready');