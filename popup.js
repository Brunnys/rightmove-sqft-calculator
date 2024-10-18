document.addEventListener('DOMContentLoaded', function() {
    const priceElement = document.getElementById('price');
    const squareFootageElement = document.getElementById('squareFootage');
    const squareFootageInput = document.getElementById('squareFootageInput');
    const editButton = document.getElementById('editButton');
    const pricePerSqFtElement = document.getElementById('pricePerSqFt');
    const calculateButton = document.querySelector('.calculate-button');
    const spinner = calculateButton.querySelector('.spinner');
    const buttonText = calculateButton.querySelector('.button-text');
    const unitToggle = document.getElementById('unitToggle');
    const squareFootageLabel = document.getElementById('squareFootageLabel');
    const pricePerSqFtLabel = document.getElementById('pricePerSqFtLabel');
    const unitLabel = document.getElementById('unitLabel');

    let currentUrl = '';
    let isEditing = false;
    let isSquareFootageEdited = false;

    // Load any saved results and manual entry
    loadResults();

    function updateDisplay(result) {
      priceElement.textContent = result.price;
      squareFootageElement.textContent = result.squareFootage;
      pricePerSqFtElement.textContent = result.pricePerSqFt;
      if (result.timestamp) {
        updateLastUpdatedTime(result.timestamp);
      }
    }

    function toggleEdit() {
      isEditing = !isEditing;
      if (isEditing) {
        squareFootageElement.classList.add('hidden');
        squareFootageInput.classList.remove('hidden');
        squareFootageInput.value = squareFootageElement.textContent.replace(/[^\d.]/g, ''); // Remove non-numeric characters
        squareFootageInput.focus();
      } else {
        squareFootageElement.classList.remove('hidden');
        squareFootageInput.classList.add('hidden');
        const newSquareFootage = parseFloat(squareFootageInput.value);
        if (!isNaN(newSquareFootage) && newSquareFootage > 0) {
          squareFootageElement.textContent = `${newSquareFootage.toFixed(2)} sq ft (edited)`;
          saveManualEntry(newSquareFootage);
          isSquareFootageEdited = true; // Set the flag to indicate the square footage has been edited
        }
      }
    }

    function recalculateAndUpdate() {
      const price = parseFloat(priceElement.textContent.replace(/[£,]/g, ''));
      const squareFootage = parseFloat(squareFootageElement.textContent);
      if (!isNaN(price) && !isNaN(squareFootage) && squareFootage > 0) {
        const pricePerSqFt = Math.round(price / squareFootage); // Round to the nearest whole pound
        pricePerSqFtElement.textContent = `£${pricePerSqFt}`;
        saveResults();
      }
    }

    function saveResults() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        const propertyId = getPropertyIdFromUrl(currentUrl);
        if (propertyId) {
          const results = {
            price: priceElement.textContent,
            squareFootage: squareFootageElement.textContent,
            pricePerSqFt: pricePerSqFtElement.textContent,
            timestamp: new Date().toISOString()
          };
          chrome.storage.local.set({ [propertyId]: results }, function() {
            console.log('Results saved for property ID:', propertyId);
            updateLastUpdatedTime(results.timestamp);
          });
        }
      });
    }

    function saveManualEntry(manualValue) {
      chrome.storage.local.get(currentUrl, function(result) {
        const data = result[currentUrl] || {};
        data.manualSquareFootage = manualValue;
        chrome.storage.local.set({[currentUrl]: data}, function() {
          console.log('Manual square footage saved for:', currentUrl);
        });
      });
    }

    function loadResults() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        const propertyId = getPropertyIdFromUrl(currentUrl);
        if (propertyId) {
          chrome.storage.local.get(propertyId, function(result) {
            if (result[propertyId]) {
              updateDisplay(result[propertyId]);
            }
          });
        }
      });
    }

    function showLoading() {
      spinner.classList.remove('hidden');
      buttonText.textContent = 'Calculating...';
      calculateButton.disabled = true;
    }

    function hideLoading() {
      spinner.classList.add('hidden');
      buttonText.textContent = 'Calculate';
      calculateButton.disabled = false;
    }

    calculateButton.addEventListener('click', function() {
      showLoading();
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "calculate"}, function(response) {
          hideLoading();
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError.message);
            displayError("Could not establish connection. Please refresh the page and try again.");
            return;
          }
          if (response && response.result) {
            if (isSquareFootageEdited) {
              // Use the edited square footage value
              const newSquareFootage = parseFloat(squareFootageInput.value);
              if (!isNaN(newSquareFootage) && newSquareFootage > 0) {
                squareFootageElement.textContent = `${newSquareFootage.toFixed(2)} sq ft (edited)`;
                response.result.squareFootage = newSquareFootage;
                response.result.pricePerSqFt = `£${(parseFloat(priceElement.textContent.replace(/[£,]/g, '')) / newSquareFootage).toFixed(2)}`;
                response.result.timestamp = new Date().toISOString();
                updateDisplay(response.result);
                saveResults();
                isSquareFootageEdited = false; // Reset the flag
              } else {
                displayError("Invalid square footage value. Please try again.");
              }
            } else {
              // Use the original calculation result
              response.result.timestamp = new Date().toISOString();
              updateDisplay(response.result);
              saveResults();
            }
          } else {
            displayError("Calculation failed. Please try again.");
          }
        });
      });
    });

    editButton.addEventListener('click', toggleEdit);

    squareFootageInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        toggleEdit();
      }
    });

    squareFootageInput.addEventListener('blur', function() {
      if (isEditing) {
        toggleEdit();
      }
    });

    function displayError(message) {
      // Assuming you have an element to display errors, e.g., <div id="error-message"></div>
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        // Optionally, hide the error message after a few seconds
        setTimeout(() => {
          errorElement.classList.add('hidden');
        }, 5000);
      }
    }

    function updateLastUpdatedTime(timestamp) {
      const lastUpdatedElement = document.getElementById('lastUpdated');
      if (lastUpdatedElement) {
        const date = new Date(timestamp);
        lastUpdatedElement.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        lastUpdatedElement.classList.remove('hidden');
      }
    }

    unitToggle.addEventListener('change', function() {
      if (this.checked) {
        convertToMeters();
      } else {
        convertToFeet();
      }
      chrome.storage.local.set({unitToggleState: this.checked});
    });

    function convertToMeters() {
      unitLabel.textContent = 'Price per sq m';
      squareFootageLabel.textContent = 'Square Meters:';
      // Convert square footage to square meters
      const squareFootage = parseFloat(squareFootageElement.textContent);
      if (!isNaN(squareFootage)) {
        const squareMeters = (squareFootage / 10.7639).toFixed(2);
        squareFootageElement.textContent = `${squareMeters} sq m`;
      }
      // Convert price per sq ft to price per sq m
      const pricePerSqFt = parseFloat(pricePerSqFtElement.textContent.replace(/[£,]/g, ''));
      if (!isNaN(pricePerSqFt)) {
        const pricePerSqM = Math.round(pricePerSqFt * 10.7639);
        pricePerSqFtElement.textContent = `£${pricePerSqM}`;
      }
    }

    function convertToFeet() {
      unitLabel.textContent = 'Price per sq ft';
      squareFootageLabel.textContent = 'Square Feet:';
      // Convert square meters to square feet
      const squareMeters = parseFloat(squareFootageElement.textContent);
      if (!isNaN(squareMeters)) {
        const squareFootage = (squareMeters * 10.7639).toFixed(2);
        squareFootageElement.textContent = `${squareFootage} sq ft`;
      }
      // Convert price per sq m to price per sq ft
      const pricePerSqM = parseFloat(pricePerSqFtElement.textContent.replace(/[£,]/g, ''));
      if (!isNaN(pricePerSqM)) {
        const pricePerSqFt = Math.round(pricePerSqM / 10.7639);
        pricePerSqFtElement.textContent = `£${pricePerSqFt}`;
      }
    }

    // Load saved toggle state
    chrome.storage.local.get('unitToggleState', function(result) {
      unitToggle.checked = result.unitToggleState === true; // Explicitly check for true
      if (unitToggle.checked) {
        convertToMeters();
      } else {
        convertToFeet(); // Ensure we're in feet mode if toggle is off or undefined
      }
    });

    function getPropertyIdFromUrl(url) {
      const match = url.match(/\/properties\/(\d+)/);
      return match ? match[1] : null;
    }
});
