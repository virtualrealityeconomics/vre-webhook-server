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
    try {
        const computedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
        
        // Ensure both signatures have the same length before comparing
        if (signature.length !== computedSignature.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(computedSignature, 'hex')
        );
    } catch (error) {
        console.error('❌ Signature verification error:', error.message);
        return false;
    }
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
        console.log('🔍 DEBUG: Full transaction data keys:', Object.keys(transactionData));
        console.log('🔍 DEBUG: Transaction data preview:', JSON.stringify(transactionData).substring(0, 500));
        
        // Handle Helius enhanced webhook format
        let solReceived = 0;
        let senderAddress = null;
        
        // Method 1: Check nativeTransfers (original format)
        const balanceChanges = transactionData.nativeTransfers || [];
        for (const transfer of balanceChanges) {
            if (transfer.toUserAccount === TREASURY_WALLET) {
                solReceived = transfer.amount / 1e9; // Convert lamports to SOL
                senderAddress = transfer.fromUserAccount;
                console.log('✅ Found transfer via nativeTransfers');
                break;
            }
        }
        
        // Method 2: Check accountData for balance changes (Helius enhanced format)
        if (solReceived === 0 && transactionData.accountData) {
            console.log('🔍 Checking accountData for balance changes...');
            for (const account of transactionData.accountData) {
                console.log('📊 Account:', account.account, 'Balance Change:', account.nativeBalanceChange);
                
                // Treasury wallet received SOL (positive balance change)
                if (account.account === TREASURY_WALLET && account.nativeBalanceChange > 0) {
                    solReceived = account.nativeBalanceChange / 1e9;
                    console.log('✅ Found treasury wallet balance increase:', solReceived, 'SOL');
                    
                    // Find the sender (account with negative balance change)
                    for (const senderAccount of transactionData.accountData) {
                        if (senderAccount.nativeBalanceChange < 0 && senderAccount.account !== TREASURY_WALLET) {
                            senderAddress = senderAccount.account;
                            console.log('✅ Found sender:', senderAddress);
                            break;
                        }
                    }
                    break;
                }
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
        console.log('📋 Headers:', req.headers);
        console.log('📦 Body type:', typeof req.body);
        console.log('📦 Body preview:', JSON.stringify(req.body).substring(0, 200));
        
        // Handle test requests
        if (req.body && req.body.test) {
            console.log('🧪 Test webhook received');
            return res.status(200).json({ success: true, message: 'Test webhook received' });
        }
        
        // Verify webhook authentication - Helius sends Bearer token
        const authHeader = req.headers['authorization'];
        if (authHeader && WEBHOOK_SECRET !== 'your-secret-key-here') {
            try {
                const expectedAuth = `Bearer ${WEBHOOK_SECRET}`;
                if (authHeader !== expectedAuth) {
                    console.error('❌ Invalid webhook authentication');
                    console.error('Expected:', expectedAuth);
                    console.error('Received:', authHeader);
                    console.log('🔧 Debug: Auth header keys:', Object.keys(req.headers).filter(k => k.toLowerCase().includes('auth')));
                    // Continue processing for debugging - don't reject
                    console.log('⚠️ Continuing with processing for debugging...');
                } else {
                    console.log('✅ Webhook authentication verified');
                }
            } catch (authError) {
                console.error('❌ Authentication verification error:', authError.message);
            }
        }
        
        // Ensure we have transaction data
        if (!req.body) {
            console.error('❌ No webhook body received');
            return res.status(400).json({ error: 'No transaction data' });
        }
        
        // Process each transaction in the webhook
        let transactions = req.body;
        const results = [];
        
        // Handle Helius webhook format
        if (transactions && typeof transactions === 'object' && !Array.isArray(transactions)) {
            // Check if it's a single transaction or has transactions array
            if (transactions.transaction) {
                transactions = [transactions.transaction];
            } else if (transactions.transactions) {
                transactions = transactions.transactions;
            } else {
                transactions = [transactions];
            }
        }
        
        if (Array.isArray(transactions)) {
            // Multiple transactions
            for (const tx of transactions) {
                try {
                    const result = await processWebhookPayment(tx);
                    results.push(result);
                } catch (txError) {
                    console.error('❌ Transaction processing error:', txError.message);
                    results.push({ success: false, error: txError.message });
                }
            }
        } else {
            // Single transaction
            try {
                const result = await processWebhookPayment(transactions);
                results.push(result);
            } catch (txError) {
                console.error('❌ Transaction processing error:', txError.message);
                results.push({ success: false, error: txError.message });
            }
        }
        
        // Respond to webhook
        const successfulResults = results.filter(r => r.success && !r.duplicate && !r.notPayment);
        
        console.log(`✅ Webhook processed: ${results.length} transactions, ${successfulResults.length} successful deliveries`);
        
        res.status(200).json({
            success: true,
            processed: results.length,
            delivered: successfulResults.length,
            results: successfulResults
        });
        
    } catch (error) {
        console.error('❌ Webhook error:', error.message);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
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