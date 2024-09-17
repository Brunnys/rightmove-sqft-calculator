document.addEventListener('DOMContentLoaded', function() {
    const priceElement = document.getElementById('price');
    const squareFootageElement = document.getElementById('squareFootage');
    const squareFootageInput = document.getElementById('squareFootageInput');
    const editButton = document.getElementById('editButton');
    const pricePerSqFtElement = document.getElementById('pricePerSqFt');
    const calculateButton = document.querySelector('.calculate-button');
  
    let currentUrl = '';
    let isEditing = false;
  
    // Load any saved results and manual entry
    loadResults();
  
    function updateDisplay(result) {
      priceElement.textContent = result.price;
      squareFootageElement.textContent = result.squareFootage;
      pricePerSqFtElement.textContent = result.pricePerSqFt;
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
          recalculateAndUpdate();
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
        pricePerSqFt: pricePerSqFtElement.textContent
      };
      chrome.storage.local.set({ [currentUrl]: results }, function() {
        console.log('Results saved');
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
  
    calculateButton.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "calculate"}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError.message);
            return;
          }
          if (response && response.result) {
            updateDisplay(response.result);
            saveResults();
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
  });