const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
    SystemProgram
} = require('@solana/web3.js');
const {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    createFreezeAccountInstruction,
    createThawAccountInstruction,
    TOKEN_PROGRAM_ID,
    getAccount,
    AccountLayout
} = require('@solana/spl-token');
const bs58 = require('bs58');

// Configuration
const VRE_MINT = 'FJHQH4WTDukwyeFov2H7U9GZSiy4PPYLeuMGpbCujZd9';
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Load authority keypair from environment
function getAuthorityKeypair() {
    const privateKeyString = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKeyString) {
        throw new Error('SOLANA_PRIVATE_KEY environment variable not set. Please configure the VRE token mint authority private key.');
    }

    try {
        // Try parsing as JSON array first (standard format)
        const privateKeyArray = JSON.parse(privateKeyString);
        return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    } catch (e) {
        try {
            // Try parsing as base58 string
            const privateKeyBytes = bs58.decode(privateKeyString);
            return Keypair.fromSecretKey(privateKeyBytes);
        } catch (e2) {
            throw new Error('Invalid SOLANA_PRIVATE_KEY format. Expected JSON array or base58 string.');
        }
    }
}

// JavaScript-based VRE token delivery (no CLI required)
async function jsDeliverVRE(buyerWalletAddress, amountVRE) {
    try {
        console.log('🚀 JS-BASED VRE DELIVERY STARTING...');
        console.log('👤 Buyer:', buyerWalletAddress);
        console.log('💰 Amount:', amountVRE, 'VRE tokens');

        // Get authority keypair
        const authority = getAuthorityKeypair();
        console.log('🔑 Authority:', authority.publicKey.toString());

        // Convert addresses to PublicKeys
        const mintPubkey = new PublicKey(VRE_MINT);
        const buyerPubkey = new PublicKey(buyerWalletAddress);

        // Get buyer's associated token account address
        const buyerTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            buyerPubkey
        );

        console.log('🏦 Buyer token account:', buyerTokenAccount.toString());

        // Check if buyer's token account exists and if it's frozen
        let accountExists = false;
        let accountFrozen = false;
        try {
            const accountInfo = await getAccount(connection, buyerTokenAccount);
            accountExists = true;
            accountFrozen = accountInfo.isFrozen;
            console.log('✅ Buyer token account exists');
            console.log(`🔒 Account frozen status: ${accountFrozen}`);
        } catch (error) {
            console.log('🆕 Buyer token account does not exist, will create');
        }

        // Create transaction
        const transaction = new Transaction();

        // Add create token account instruction if needed
        if (!accountExists) {
            const createAccountIx = createAssociatedTokenAccountInstruction(
                authority.publicKey, // payer
                buyerTokenAccount,   // token account
                buyerPubkey,         // owner
                mintPubkey           // mint
            );
            transaction.add(createAccountIx);
            console.log('📝 Added create token account instruction');
        }

        // If account is frozen, unfreeze it first (Liberation Day Lock logic)
        if (accountExists && accountFrozen) {
            const thawIx = createThawAccountInstruction(
                buyerTokenAccount,   // account to unfreeze
                mintPubkey,         // mint
                authority.publicKey // freeze authority
            );
            transaction.add(thawIx);
            console.log('🔓 Added thaw instruction (account was frozen)');
        }

        // Convert VRE amount to token units (VRE has 9 decimals)
        const tokenAmount = Math.floor(amountVRE * 1000000000);

        // Get authority's token account (treasury)
        const authorityTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            authority.publicKey
        );

        // Add transfer instruction
        const transferIx = createTransferInstruction(
            authorityTokenAccount, // source
            buyerTokenAccount,     // destination
            authority.publicKey,   // owner of source
            tokenAmount           // amount in token units
        );
        transaction.add(transferIx);
        console.log('📝 Added transfer instruction:', tokenAmount, 'token units');

        // Add freeze instruction (Liberation Day Lock)
        const freezeIx = createFreezeAccountInstruction(
            buyerTokenAccount,   // account to freeze
            mintPubkey,         // mint
            authority.publicKey // freeze authority
        );
        transaction.add(freezeIx);
        console.log('📝 Added freeze instruction for Liberation Day Lock');

        // Send transaction
        console.log('📡 Sending transaction...');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [authority],
            {
                commitment: 'confirmed',
                maxRetries: 3
            }
        );

        console.log('✅ DELIVERY SUCCESSFUL!');
        console.log('🔗 Transaction signature:', signature);

        return {
            success: true,
            amount: amountVRE,
            transferSignature: signature,
            buyerTokenAccount: buyerTokenAccount.toString(),
            message: `Delivered ${amountVRE} VRE tokens (frozen until Liberation Day)`
        };

    } catch (error) {
        console.error('❌ JS DELIVERY FAILED:', error.message);
        console.error('🔧 Error details:', error);

        return {
            success: false,
            error: error.message,
            details: error.toString()
        };
    }
}

// Export the function
module.exports = {
    jsDeliverVRE
};

console.log('🚀 JavaScript-based VRE Token Distributor Loaded');
console.log('🪙 VRE Token Mint:', VRE_MINT);
console.log('🔐 Liberation Day Lock: Integrated');
console.log('💡 No CLI dependency - Pure JavaScript implementation');