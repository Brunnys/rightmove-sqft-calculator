document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculateBtn');
    const resultDiv = document.getElementById('result');

    // Load and display the last calculation result when popup opens
    chrome.storage.local.get('lastCalculation', function(data) {
        if (data.lastCalculation) {
            displayResult(data.lastCalculation);
        }
    });

    calculateBtn.addEventListener('click', function() {
        calculateBtn.disabled = true;
        resultDiv.textContent = 'Calculating...';

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "calculate"}, function(response) {
                calculateBtn.disabled = false;
                if (chrome.runtime.lastError) {
                    resultDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    return;
                }
                if (response && response.result) {
                    displayResult(response.result);
                } else if (response && response.error) {
                    resultDiv.textContent = 'Error: ' + response.error;
                } else {
                    resultDiv.textContent = 'Unexpected response format';
                }
            });
        });
    });
});

function displayResult(result) {
    const resultDiv = document.getElementById('result');
    let timestampString = 'Unknown';
    
    if (result.timestamp) {
        const date = new Date(result.timestamp);
        if (!isNaN(date.getTime())) { // Check if the date is valid
            timestampString = date.toLocaleString();
        } else {
            console.error('Invalid timestamp:', result.timestamp);
        }
    }

    resultDiv.innerHTML = `
        <p><strong>Price:</strong> ${result.price}</p>
        <p><strong>Square Footage:</strong> ${result.squareFootage}</p>
        <p><strong>Price per sq ft:</strong> ${result.pricePerSqFt}</p>
        <p><small>Last calculated: ${timestampString}</small></p>
    `;
}

console.log('Popup script loaded');