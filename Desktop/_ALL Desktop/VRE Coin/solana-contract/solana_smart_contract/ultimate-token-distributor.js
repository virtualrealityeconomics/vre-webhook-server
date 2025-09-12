const { execSync } = require('child_process');
const { Connection, PublicKey } = require('@solana/web3.js');

// Configuration
const VRE_MINT = '2gV6LWHFji9XFUBdXKYWspE8KKQJwgNGn9jvfT5tWG5Y';
const connection = new Connection('https://api.devnet.solana.com');

console.log('⚡ ULTIMATE VRE Token Distributor with Liberation Day Lock');
console.log('🪙 VRE Token Mint:', VRE_MINT);
console.log('🔐 Liberation Day: July 18, 2028');
console.log('🧠 Smart Features: Unfreeze → Transfer → Freeze for multiple purchases');
console.log('');

// Function to check if account is frozen using spl-token CLI
function checkAccountFrozenStatus(walletAddress) {
    try {
        const command = `spl-token account-info ${VRE_MINT} ${walletAddress}`;
        const output = execSync(command, { encoding: 'utf8' });
        
        // Parse the output to find State
        const stateMatch = output.match(/State: (\w+)/);
        const balanceMatch = output.match(/Balance: (\d+)/);
        const addressMatch = output.match(/Address: ([A-Za-z0-9]+)/);
        
        if (stateMatch && balanceMatch && addressMatch) {
            const isFrozen = stateMatch[1] === 'Frozen';
            const balance = parseInt(balanceMatch[1]);
            const tokenAccount = addressMatch[1];
            
            return {
                exists: true,
                frozen: isFrozen,
                balance: balance / Math.pow(10, 9), // Convert to VRE tokens
                tokenAccount
            };
        }
        
        return { exists: false };
    } catch (error) {
        // Account doesn't exist or other error
        return { exists: false, error: error.message };
    }
}

// ULTIMATE SMART DELIVERY: Handles ALL cases perfectly
async function ultimateDeliverVRE(buyerWalletAddress, amountVRE) {
    console.log(`\n🎯 ULTIMATE SMART DELIVERY`);
    console.log(`👤 Buyer: ${buyerWalletAddress}`);
    console.log(`💰 Amount: ${amountVRE} VRE tokens`);
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    try {
        // Step 1: Check account status
        console.log('🔍 Checking account status...');
        const accountStatus = checkAccountFrozenStatus(buyerWalletAddress);
        console.log('📊 Account Status:', accountStatus);
        
        let process = '';
        let transferSignature = 'unknown'; // Declare at function scope
        
        // Step 2: Handle based on account status
        if (!accountStatus.exists) {
            // New account - Transfer and Freeze
            process = 'transfer-freeze';
            console.log('🆕 New account detected');
            
            console.log('💸 TRANSFER: Sending VRE tokens to new account...');
            const transferCommand = `spl-token transfer ${VRE_MINT} ${amountVRE} ${buyerWalletAddress} --allow-unfunded-recipient --fund-recipient`;
            const transferOutput = execSync(transferCommand, { encoding: 'utf8' });
            
            // Extract signature from output
            const signatureMatch = transferOutput.match(/Signature: ([A-Za-z0-9]+)/);
            transferSignature = signatureMatch ? signatureMatch[1] : 'unknown';
            
            console.log('✅ TRANSFER COMPLETE:', transferSignature);
            
        } else if (accountStatus.frozen) {
            // Frozen account - Unfreeze, Transfer, and Freeze
            process = 'unfreeze-transfer-freeze';
            console.log('🔒 Frozen account detected - implementing smart sequence');
            
            console.log('🔓 UNFREEZE: Temporarily unfreezing account...');
            const unfreezeCommand = `spl-token thaw ${accountStatus.tokenAccount}`;
            execSync(unfreezeCommand);
            console.log('✅ UNFREEZE COMPLETE');
            
            console.log('💸 TRANSFER: Sending VRE tokens...');
            const transferCommand = `spl-token transfer ${VRE_MINT} ${amountVRE} ${buyerWalletAddress}`;
            const transferOutput = execSync(transferCommand, { encoding: 'utf8' });
            
            const signatureMatch = transferOutput.match(/Signature: ([A-Za-z0-9]+)/);
            transferSignature = signatureMatch ? signatureMatch[1] : 'unknown';
            
            console.log('✅ TRANSFER COMPLETE:', transferSignature);
            
        } else {
            // Unfrozen existing account - Transfer and Freeze  
            process = 'transfer-freeze';
            console.log('🔓 Unfrozen account detected');
            
            console.log('💸 TRANSFER: Sending VRE tokens...');
            const transferCommand = `spl-token transfer ${VRE_MINT} ${amountVRE} ${buyerWalletAddress}`;
            const transferOutput = execSync(transferCommand, { encoding: 'utf8' });
            
            const signatureMatch = transferOutput.match(/Signature: ([A-Za-z0-9]+)/);
            transferSignature = signatureMatch ? signatureMatch[1] : 'unknown';
            
            console.log('✅ TRANSFER COMPLETE:', transferSignature);
        }
        
        // Step 3: Always freeze at the end (Liberation Day Lock)
        console.log('🔒 FREEZE: Locking account until Liberation Day...');
        const finalStatus = checkAccountFrozenStatus(buyerWalletAddress);
        const freezeCommand = `spl-token freeze ${finalStatus.tokenAccount}`;
        const freezeOutput = execSync(freezeCommand, { encoding: 'utf8' });
        
        const freezeSignatureMatch = freezeOutput.match(/Signature: ([A-Za-z0-9]+)/);
        const freezeSignature = freezeSignatureMatch ? freezeSignatureMatch[1] : 'unknown';
        
        console.log('❄️  FREEZE COMPLETE:', freezeSignature);
        console.log('🔐 Account locked until Liberation Day (July 18, 2028)');
        
        // Step 4: Final verification
        const finalAccountStatus = checkAccountFrozenStatus(buyerWalletAddress);
        
        console.log(`\n🎉 ULTIMATE DELIVERY SUCCESSFUL!`);
        console.log(`📦 Delivered: ${amountVRE} VRE tokens`);
        console.log(`💰 New Balance: ${finalAccountStatus.balance} VRE tokens`);
        console.log(`🔒 Status: LOCKED until Liberation Day`);
        console.log(`⚡ Process: ${process}`);
        
        return {
            success: true,
            amount: amountVRE,
            newBalance: finalAccountStatus.balance,
            tokenAccount: finalAccountStatus.tokenAccount,
            process,
            frozen: finalAccountStatus.frozen,
            transferSignature: transferSignature || 'unknown'
        };
        
    } catch (error) {
        console.error('❌ ULTIMATE DELIVERY FAILED:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export functions
module.exports = {
    ultimateDeliverVRE,
    checkAccountFrozenStatus,
    VRE_MINT
};

// Example usage if running directly
if (require.main === module) {
    console.log('🧪 ULTIMATE TOKEN DISTRIBUTOR READY');
    console.log('📞 Available functions:');
    console.log('  • ultimateDeliverVRE(walletAddress, amount)');
    console.log('  • checkAccountFrozenStatus(walletAddress)');
    console.log('');
    console.log('🎯 Features:');
    console.log('  ✅ Handles ALL account states perfectly');
    console.log('  ✅ New accounts: Transfer → Freeze');
    console.log('  ✅ Frozen accounts: Unfreeze → Transfer → Freeze');
    console.log('  ✅ Unfrozen accounts: Transfer → Freeze');
    console.log('  ✅ Liberation Day lock enforcement');
    console.log('  ✅ Multiple purchases support');
    console.log('  ✅ Uses reliable spl-token CLI commands');
}