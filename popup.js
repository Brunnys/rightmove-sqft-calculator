document.addEventListener('DOMContentLoaded', function() {
    const calculateButton = document.getElementById('calculateButton');
    const resultDiv = document.getElementById('result');
    const editButton = document.getElementById('editSquareFootage');
    const editInput = document.getElementById('editSquareFootageInput');
    const manualInput = document.getElementById('manualSquareFootage');
    const saveButton = document.getElementById('saveSquareFootage');

    let currentUrl = '';
    let currentPrice = '';

    function updateResult(result) {
        document.getElementById('price').textContent = result.price;
        document.getElementById('squareFootage').textContent = result.squareFootage;
        document.getElementById('pricePerSqFt').textContent = result.pricePerSqFt;
    }

    function recalculatePricePerSqFt(price, squareFootage) {
        if (price && squareFootage) {
            const numericPrice = parseFloat(price.replace(/[£,]/g, ''));
            return `£${(numericPrice / squareFootage).toFixed(2)}`;
        }
        return 'N/A';
    }

    calculateButton.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            currentUrl = tabs[0].url;
            chrome.tabs.sendMessage(tabs[0].id, {action: "calculate"}, function(response) {
                if (chrome.runtime.lastError) {
                    resultDiv.innerHTML = `<p>Error: ${chrome.runtime.lastError.message}</p>`;
                    return;
                }
                if (response && response.result) {
                    updateResult(response.result);
                    currentPrice = response.result.price;
                } else if (response && response.error) {
                    resultDiv.innerHTML = `<p>Error: ${response.error}</p>`;
                } else {
                    resultDiv.innerHTML = '<p>No result received</p>';
                }
            });
        });
    });

    editButton.addEventListener('click', function() {
        editInput.style.display = 'block';
        const currentSquareFootage = document.getElementById('squareFootage').textContent;
        if (currentSquareFootage !== 'No floor plan found' && currentSquareFootage !== 'Poor floorplan image quality, cannot read') {
            manualInput.value = parseFloat(currentSquareFootage);
        }
    });

    saveButton.addEventListener('click', function() {
        const manualValue = parseFloat(manualInput.value);
        if (isNaN(manualValue) || manualValue <= 0) {
            alert('Please enter a valid positive number for square footage.');
            return;
        }

        const newSquareFootage = manualValue.toFixed(2);
        document.getElementById('squareFootage').textContent = `${newSquareFootage} sq ft (edited)`;
        document.getElementById('pricePerSqFt').textContent = recalculatePricePerSqFt(currentPrice, manualValue);
        editInput.style.display = 'none';

        // Save the manual entry to storage
        chrome.storage.local.set({[currentUrl]: {manualSquareFootage: manualValue}}, function() {
            console.log('Manual square footage saved for:', currentUrl);
        });
    });

    // Load manual entry if it exists
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        currentUrl = tabs[0].url;
        chrome.storage.local.get(currentUrl, function(result) {
            if (result[currentUrl] && result[currentUrl].manualSquareFootage) {
                const manualValue = result[currentUrl].manualSquareFootage;
                document.getElementById('squareFootage').textContent = `${manualValue.toFixed(2)} sq ft (edited)`;
                manualInput.value = manualValue;
            }
        });
    });
});