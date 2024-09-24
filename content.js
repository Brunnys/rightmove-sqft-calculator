console.log('Content script starting...');

const CACHE_KEY = 'rightmoveOcrCache';

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function extractPrice() {
  try {
    // Use a specific selector to find the price element
    const priceElement = document.querySelector('div._1gfnqJ3Vtd1z40MlC0MzXu > span');
    if (priceElement) {
      const priceText = priceElement.textContent.trim();
      const priceMatch = priceText.match(/£([\d,]+)/);
      if (priceMatch) {
        const price = priceMatch[0];
        console.log('Extracted price:', price);
        return price;
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
    const floorplanLink = document.querySelector('a[href*="floorplan"]');
    return floorplanLink ? floorplanLink.href : null;
}

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

    // Improved regex for square feet
    const sqftRegex = /(?:\(|\b)(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\w+)\s*(?:sq(?:uare)?\.?\s*(?:ft|feet|foot|ft)?|ft\.?|sq\.?\s*ft\.?)(?:\)|\b)/gi;
    

    // Function to extract all matches and log them to the console
    function extractAllMatches(regex, text) {
      const matches = [];
      let match;
      let iterationCount = 0;
      const maxIterations = 10000; // Safeguard to prevent infinite loop

      while ((match = regex.exec(text)) !== null) {
        let value = match[1].replace(/,/g, '');
        let parsedValue = parseFloat(value);
        if (!isNaN(parsedValue)) {
          matches.push(parsedValue);
          console.log(`Matched number: ${parsedValue}`);
        } else {
          console.log(`Failed to parse number: ${value}`);
        }
        // Move to the next potential match
        regex.lastIndex = match.index + match[0].length;

        // Safeguard to prevent infinite loop
        iterationCount++;
        if (iterationCount > maxIterations) {
          console.error('Exceeded maximum iterations in extractAllMatches');
          break;
        }
      }
      return matches;
    }

    // Extract all square feet matches
    let sqftMatches = extractAllMatches(sqftRegex, text);

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
      // Only cache successful results
      await cacheResult(floorplanUrl, result);
    } else {
      console.log('No sq ft found in text');
      result = {
        squareFootage: null,
        unit: null,
        rawText: text,
        error: "Can't find sq ft, enter manually"
      };
      // Do not cache unsuccessful results
    }

    return result;
  } catch (error) {
    console.error('Error in extractSquareFootage:', error);
    return {
      squareFootage: null,
      unit: null,
      rawText: 'OCR failed: ' + error.message,
      error: "Poor floorplan image quality"
    };
    // Do not cache error results
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

// Function to log the time taken for a calculation
async function logTimeTaken(fn, ...args) {
  const startTime = performance.now();
  const result = await fn(...args);
  const endTime = performance.now();
  console.log(`Time taken: ${(endTime - startTime).toFixed(2)} milliseconds`);
  return result;
}

// Main function to handle the calculation request
async function handleCalculateRequest() {
  try {
    const price = extractPrice();
    console.log('Extracted price:', price);

    const floorplanUrl = findFloorplanUrl();
    console.log('Found floorplan URL:', floorplanUrl);

    let squareFootage = null;
    let squareFootageMessage = null;

    if (floorplanUrl) {
      console.log('Attempting to extract square footage...');
      const result = await extractSquareFootage(floorplanUrl);
      if (result.squareFootage) {
        squareFootage = result.squareFootage;
      } else {
        squareFootageMessage = result.error || "Unable to extract sq ft";
      }
    } else {
      console.log('No floorplan URL found');
      squareFootageMessage = "No floorplan found";
    }

    const calculationResult = {
      price: price || 'Not found',
      squareFootage: squareFootage ? `${squareFootage.toFixed(2)} sq ft` : squareFootageMessage,
      pricePerSqFt: price && squareFootage ? `£${(parseFloat(price.replace(/[£,]/g, '')) / squareFootage).toFixed(2)}` : 'N/A'
    };

    console.log('Calculation result:', calculationResult);
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
    logTimeTaken(handleCalculateRequest)
      .then(result => {
        console.log('Sending calculation result:', result);
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