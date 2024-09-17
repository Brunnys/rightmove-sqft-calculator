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
    
    // Function to convert written numbers to digits
    function wordToNumber(word) {
      const numbers = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
        'hundred': 100, 'thousand': 1000, 'million': 1000000
      };
      return numbers[word.toLowerCase()] || word;
    }

    // Improved regex for square feet
    const sqftRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\w+)\s*(?:sq(?:uare)?\.?\s*(?:ft|feet|foot)|ft\.?|sq\.?\s*ft\.?)/i;
    
    // Regex for square meters
    const sqmRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\w+)\s*(?:sq(?:uare)?\.?\s*(?:m|meters?|metres?)|m\.?|sq\.?\s*m\.?)/i;

    // Function to extract all matches
    function extractAllMatches(regex, text) {
      const matches = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        let value = match[1].replace(/,/g, '');
        if (isNaN(value)) {
          value = wordToNumber(value);
        }
        matches.push(parseFloat(value));
        text = text.slice(match.index + match[0].length);
      }
      return matches;
    }

    // Extract all square feet and square meter matches
    let sqftMatches = extractAllMatches(sqftRegex, text);
    let sqmMatches = extractAllMatches(sqmRegex, text);

    // Convert sq m to sq ft if necessary
    if (sqftMatches.length === 0 && sqmMatches.length > 0) {
      sqftMatches = sqmMatches.map(sqm => sqm * 10.7639);
    }

    // Get the largest value
    const squareFootage = Math.max(...sqftMatches, 0);

    let result;
    if (squareFootage > 0) {
      console.log(`Extracted: ${squareFootage.toFixed(2)} sq ft`);
      result = { 
        squareFootage: squareFootage,
        unit: 'sq ft',
        rawText: text 
      };
    } else {
      console.log('No square footage found in text');
      result = { squareFootage: null, unit: null, rawText: text };
    }
    
    // Cache the result
    await cacheResult(floorplanUrl, result);
    
    return result;
  } catch (error) {
    console.error('Error in extractSquareFootage:', error);
    return { squareFootage: null, unit: null, rawText: 'OCR failed: ' + error.message };
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
    let unit = null;
    let rawOcrText = null;
    if (floorplanUrl) {
      console.log('Attempting to extract square footage...');
      const result = await extractSquareFootage(floorplanUrl);
      squareFootage = result.squareFootage;
      unit = result.unit;
      rawOcrText = result.rawText;
    } else {
      console.log('No floorplan URL found, skipping square footage extraction');
    }

    const pricePerSqFt = price && squareFootage ? 
      (parseFloat(price.replace(/[£,]/g, '')) / squareFootage).toFixed(2) : 'N/A';

    const calculationResult = {
      price: price || 'Not found',
      squareFootage: squareFootage ? `${squareFootage.toFixed(2)} ${unit}` : 'Not found',
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