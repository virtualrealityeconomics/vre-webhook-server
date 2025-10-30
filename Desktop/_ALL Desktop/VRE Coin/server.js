// VRE MoonPay Webhook Server - Root Level
// This file imports and runs the webhook handler from the subdirectory

const path = require('path');

// Import the webhook handler from the subdirectory
const webhookHandlerPath = path.join(__dirname, 'solana-contract', 'solana_smart_contract', 'moonpay-webhook-handler.js');

try {
    console.log('🚀 Starting VRE MoonPay Webhook Server...');
    console.log('📂 Loading handler from:', webhookHandlerPath);

    // Import and run the webhook handler
    require(webhookHandlerPath);

} catch (error) {
    console.error('❌ Failed to start webhook server:', error);
    console.error('📂 Tried to load from:', webhookHandlerPath);
    process.exit(1);
}