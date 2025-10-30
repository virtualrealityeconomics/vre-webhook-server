const express = require('express');
const { ultimateDeliverVRE } = require('./ultimate-token-distributor.js');
const { updatePurchaseWithVRESignature } = require('./firebase-updater.js');

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
    console.log(`🌐 ${new Date().toISOString()} ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// MoonPay webhook handler
app.post('/webhook', async (req, res) => {
    try {
        const { source, type } = req.body;

        // Handle MoonPay VRE delivery requests
        if (source === 'moonpay' && type === 'vre_delivery_request') {
            console.log('🌙 MOONPAY VRE DELIVERY REQUEST RECEIVED');
            console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

            const {
                user_wallet,
                vre_amount,
                purchase_id,
                moonpay_transaction_id,
                sol_received,
                usd_amount,
                firebase_path
            } = req.body;

            // Validate required fields
            if (!user_wallet || !vre_amount || !purchase_id) {
                console.error('❌ Missing required fields in MoonPay request');
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: user_wallet, vre_amount, purchase_id'
                });
            }

            console.log(`🎯 Delivering ${vre_amount} VRE tokens to ${user_wallet}`);
            console.log(`💰 SOL received: ${sol_received}, USD amount: $${usd_amount}`);
            console.log(`🆔 MoonPay TX: ${moonpay_transaction_id}`);

            try {
                // Use your existing VRE delivery system!
                console.log('🚀 INITIATING MOONPAY AUTO-DELIVERY...');
                const deliveryResult = await ultimateDeliverVRE(user_wallet, vre_amount);

                if (deliveryResult.success) {
                    console.log('✅ MOONPAY AUTO-DELIVERY SUCCESSFUL!');
                    console.log(`📦 Delivered: ${deliveryResult.amount} VRE tokens`);
                    console.log(`💰 New Balance: ${deliveryResult.newBalance} VRE tokens`);
                    console.log(`⚡ Process: ${deliveryResult.process}`);
                    console.log(`🔒 Status: Liberation Day Lock Active`);
                    console.log(`🔗 VRE Transfer Signature: ${deliveryResult.transferSignature}`);

                    // Update Firebase with MoonPay delivery info using your existing system
                    try {
                        const firebaseUpdate = await updatePurchaseWithVRESignature(
                            purchase_id, // Use purchase_id as the SOL signature equivalent
                            deliveryResult.transferSignature,
                            deliveryResult.amount,
                            deliveryResult.newBalance,
                            {
                                source: 'moonpay',
                                moonpay_transaction_id,
                                sol_received,
                                usd_amount,
                                firebase_path
                            }
                        );

                        if (firebaseUpdate.success) {
                            console.log('🔥 Firebase updated with MoonPay VRE delivery info');
                        }
                    } catch (fbError) {
                        console.error('⚠️ Firebase update failed but VRE delivery succeeded:', fbError.message);
                    }

                    res.status(200).json({
                        success: true,
                        message: 'MoonPay VRE delivery successful',
                        signature: deliveryResult.transferSignature,
                        amount: deliveryResult.amount,
                        newBalance: deliveryResult.newBalance,
                        process: deliveryResult.process,
                        userWallet: user_wallet,
                        moonpayTransactionId: moonpay_transaction_id
                    });

                } else {
                    console.error('❌ MOONPAY AUTO-DELIVERY FAILED:', deliveryResult.error);
                    res.status(500).json({
                        success: false,
                        error: 'VRE delivery failed',
                        details: deliveryResult.error,
                        userWallet: user_wallet,
                        moonpayTransactionId: moonpay_transaction_id
                    });
                }

            } catch (deliveryError) {
                console.error('❌ Error in MoonPay VRE delivery:', deliveryError);
                res.status(500).json({
                    success: false,
                    error: 'VRE delivery system error',
                    details: deliveryError.message,
                    userWallet: user_wallet,
                    moonpayTransactionId: moonpay_transaction_id
                });
            }

            return;
        }

        // Handle other webhook types (your existing Helius webhooks, etc.)
        console.log('📨 Received webhook (not MoonPay):', { source, type });

        // Add your existing webhook handlers here
        // For example:
        // if (source === 'helius') {
        //     // Handle Helius webhooks
        // }

        res.status(200).json({
            success: true,
            message: 'Webhook received but not processed',
            source,
            type
        });

    } catch (error) {
        console.error('❌ Webhook handler error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'VRE MoonPay Webhook Handler'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🌙 VRE MoonPay Webhook Handler Started');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📡 Endpoints:');
    console.log(`   POST /webhook - MoonPay & other webhooks`);
    console.log(`   GET  /health  - Health check`);
    console.log('');
    console.log('✅ Ready to receive MoonPay VRE delivery requests!');
});

module.exports = app;