document.addEventListener('DOMContentLoaded', function() {
    const priceElement = document.getElementById('price');
    const squareFootageElement = document.getElementById('squareFootage');
    const squareFootageInput = document.getElementById('squareFootageInput');
    const editButton = document.getElementById('editButton');
    const pricePerSqFtElement = document.getElementById('pricePerSqFt');
    const calculateButton = document.querySelector('.calculate-button');
    const spinner = calculateButton.querySelector('.spinner');
    const buttonText = calculateButton.querySelector('.button-text');

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
        squareFootageInput.value = squareFootageElement.textContent.replace(' sq ft', '').replace(' (edited)', '');
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
        const pricePerSqFt = (price / squareFootage).toFixed(2);
        pricePerSqFtElement.textContent = `£${pricePerSqFt}`;
        saveResults();
      }
    }

    function saveResults() {
      const results = {
        price: priceElement.textContent,
        squareFootage: squareFootageElement.textContent,
        pricePerSqFt: pricePerSqFtElement.textContent,
        timestamp: new Date().toISOString()
      };
      chrome.storage.local.set({ [currentUrl]: results }, function() {
        console.log('Results saved');
        updateLastUpdatedTime(results.timestamp);
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
        currentUrl = tabs[0].url;
        chrome.storage.local.get(currentUrl, function(result) {
          if (result[currentUrl]) {
            if (result[currentUrl].manualSquareFootage) {
              const manualValue = result[currentUrl].manualSquareFootage;
              squareFootageElement.textContent = `${manualValue.toFixed(2)} sq ft (edited)`;
              squareFootageInput.value = manualValue;
            } else {
              updateDisplay(result[currentUrl]);
            }
          }
        });
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
  });