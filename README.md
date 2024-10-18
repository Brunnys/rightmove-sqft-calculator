# SquareCalc - Rightmove Square Footage Calculator

SquareCalc is a Chrome extension that calculates the price per square foot/meter for Rightmove property listings on rightmove.co.uk.

## Features

- Automatically extracts property price and square footage from Rightmove listings
- Calculates price per square foot/meter
- Allows toggling between square feet and square meters
- Optional anonymous usage analytics

## Installation

1. Clone this GitHub repository:
   ```
   git clone https://github.com/your-username/rightmove-sqft-calculator.git
   ```
2. Set up PostHog configuration (optional):
   - Create a file named `posthog-config.js` in the root directory
   - Add the following content, replacing `'your_posthog_api_key'` with your actual PostHog API key:
     ```javascript
     const config = {
       POSTHOG_API_KEY: 'your_posthog_api_key'
     };

     posthog.init(config.POSTHOG_API_KEY, {
       api_host: 'https://eu.i.posthog.com',
       persistence: 'localStorage'
     });
     ```
3. Open Google Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the `rightmove-sqft-calculator` folder

## Usage

1. Navigate to a Rightmove property listing
2. Click the SquareCalc extension icon in your Chrome toolbar
3. The extension will automatically calculate and display the price per square foot/meter

## Privacy and Analytics

SquareCalc can use PostHog for anonymous usage analytics to help improve the extension. However, we respect your privacy:

- Analytics are opt-in and disabled by default
- You can opt-in via the checkbox in the extension popup
- No personally identifiable information is collected
- If you choose not to set up the `posthog-config.js` file, no data will be collected

## Development

To modify the extension:

1. Make your changes to the relevant files
2. If you want to enable analytics, create and modify the `posthog-config.js` file as described in the installation steps
3. Reload the extension in Chrome to see your changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

SquareCalc is not affiliated with Rightmove. It is a third-party tool designed to enhance the Rightmove browsing experience.
