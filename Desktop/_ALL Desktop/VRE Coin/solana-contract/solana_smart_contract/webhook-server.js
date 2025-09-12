const express = require('express');
const crypto = require('crypto');
const { ultimateDeliverVRE } = require('./ultimate-token-distributor.js');
const { updatePurchaseWithVRESignature } = require('./firebase-updater.js');

// Configuration
const app = express();
const PORT = process.env.PORT || 3002;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-here';
const TREASURY_WALLET = '77tdiYmGhXX5Kt1dRFCGN1wNKfTJm8SBAdY8GLBGLjvU';
const VRE_PRICE_USD = 0.20;

// Middleware
app.use(express.json());

// Store processed transactions to prevent duplicates
const processedTransactions = new Set();

console.log('🚀 VRE Webhook Server Starting...');
console.log('📍 Treasury Wallet:', TREASURY_WALLET);
console.log('💰 VRE Price: $' + VRE_PRICE_USD);
console.log('🔗 Webhook Port:', PORT);

// Webhook signature verification (security)
function verifyWebhookSignature(body, signature, secret) {
    const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(computedSignature, 'hex')
    );
}

// Function to get SOL price with fallback
async function getSOLPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        return data.solana.usd;
    } catch (error) {
        console.log('📈 Using fallback SOL price: $220');
        return 220; // Fallback price
    }
}

// Function to calculate VRE tokens from SOL amount
function calculateVREFromSOL(solAmount, solPrice) {
    const usdValue = solAmount * solPrice;
    const vreTokens = usdValue / VRE_PRICE_USD;
    return Math.round(vreTokens * 100) / 100; // Round to 2 decimals
}

// Function to process payment and deliver VRE tokens
async function processWebhookPayment(transactionData) {
    const signature = transactionData.signature;
    
    // Skip if already processed
    if (processedTransactions.has(signature)) {
        console.log(`⏭️  Transaction ${signature.substring(0,8)}... already processed`);
        return { success: true, duplicate: true };
    }
    
    try {
        console.log(`\\n💳 WEBHOOK PAYMENT DETECTED`);
        console.log(`🔗 Signature: ${signature}`);
        console.log(`⏰ Time: ${new Date().toISOString()}`);
        
        // Analyze transaction for SOL transfer to treasury
        const accountKeys = transactionData.accountKeys;
        const balanceChanges = transactionData.nativeTransfers || [];
        
        // Find transfer to treasury wallet
        let solReceived = 0;
        let senderAddress = null;
        
        for (const transfer of balanceChanges) {
            if (transfer.toUserAccount === TREASURY_WALLET) {
                solReceived = transfer.amount / 1e9; // Convert lamports to SOL
                senderAddress = transfer.fromUserAccount;
                break;
            }
        }
        
        if (solReceived > 0 && senderAddress) {
            console.log(`👤 From: ${senderAddress}`);
            console.log(`🏦 To: ${TREASURY_WALLET}`);
            console.log(`💰 Amount: ${solReceived} SOL`);
            
            // Get current SOL price
            const solPrice = await getSOLPrice();
            console.log(`📈 SOL Price: $${solPrice} USD`);
            
            // Calculate VRE tokens to deliver
            const vreAmount = calculateVREFromSOL(solReceived, solPrice);
            console.log(`🎯 VRE Tokens to deliver: ${vreAmount}`);
            
            // Deliver tokens using Ultimate Token Distributor
            console.log(`🚀 INITIATING AUTO-DELIVERY...`);
            const deliveryResult = await ultimateDeliverVRE(senderAddress, vreAmount);
            
            if (deliveryResult.success) {
                console.log(`✅ WEBHOOK DELIVERY SUCCESSFUL!`);
                console.log(`📦 Delivered: ${deliveryResult.amount} VRE tokens`);
                console.log(`💰 New Balance: ${deliveryResult.newBalance} VRE tokens`);
                console.log(`⚡ Process: ${deliveryResult.process}`);
                
                // Update Firebase with VRE delivery signature
                const firebaseUpdate = await updatePurchaseWithVRESignature(
                    signature,
                    deliveryResult.transferSignature,
                    deliveryResult.amount,
                    deliveryResult.newBalance
                );
                
                if (firebaseUpdate.success) {
                    console.log(`🔥 Firebase updated with VRE delivery info`);
                }
                
                // Mark transaction as processed
                processedTransactions.add(signature);
                
                return {
                    success: true,
                    signature,
                    buyer: senderAddress,
                    solPaid: solReceived,
                    vreDelivered: deliveryResult.amount,
                    newBalance: deliveryResult.newBalance,
                    vreTransferSignature: deliveryResult.transferSignature
                };
            } else {
                console.error(`❌ WEBHOOK DELIVERY FAILED:`, deliveryResult.error);
                return { success: false, error: deliveryResult.error };
            }
        } else {
            console.log(`ℹ️  Transaction ${signature.substring(0,8)}... not a payment to treasury`);
            return { success: true, notPayment: true };
        }
        
    } catch (error) {
        console.error('❌ Error processing webhook payment:', error.message);
        return { success: false, error: error.message };
    }
}

// Main webhook endpoint
app.post('/webhook/payment', async (req, res) => {
    try {
        console.log('📨 Webhook received:', new Date().toISOString());
        
        // Verify webhook signature (security)
        const signature = req.headers['x-helius-signature'];
        if (signature && WEBHOOK_SECRET !== 'your-secret-key-here') {
            const body = JSON.stringify(req.body);
            if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
                console.error('❌ Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }
        
        // Process each transaction in the webhook
        const transactions = req.body;
        const results = [];
        
        if (Array.isArray(transactions)) {
            // Multiple transactions
            for (const tx of transactions) {
                const result = await processWebhookPayment(tx);
                results.push(result);
            }
        } else {
            // Single transaction
            const result = await processWebhookPayment(transactions);
            results.push(result);
        }
        
        // Respond to webhook
        res.status(200).json({
            success: true,
            processed: results.length,
            results: results.filter(r => r.success && !r.duplicate && !r.notPayment)
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        processedTransactions: processedTransactions.size
    });
});

// Start server (Railway deployment)
app.listen(PORT, () => {
    console.log(`\\n✅ VRE Webhook Server running on port ${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/payment`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔒 Webhook secret: ${WEBHOOK_SECRET !== 'your-secret-key-here' ? 'Configured' : 'NOT SET (dev mode)'}`);
});

module.exports = app;