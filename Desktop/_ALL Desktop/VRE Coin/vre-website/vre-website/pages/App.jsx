import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { initializeApp } from 'firebase/app';
// Firebase auth imports removed - now using wallet-based authentication
import { getFirestore, doc, setDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import WalletButton from '../components/WalletButton';
import SOLPriceTicker from '../components/SOLPriceTicker';
import TokenomicsChart from '../components/TokenomicsChart';
import useSOLPrice from '../hooks/useSOLPrice';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const appId = process.env.NEXT_PUBLIC_APP_ID || 'vre-token-sale';

// --- DApp Configuration ---
const PROGRAM_ID = "2jyUBoJk4VS5qbSWRCyscJW6LFb8ThgB5cHt71wc6FqF"; // VRE Vesting Smart Contract
const VRE_MINT_ADDRESS = "FJHQH4WTDukwyeFov2H7U9GZSiy4PPYLeuMGpbCujZd9"; // Mainnet VRE token with freeze authority
const VRE_DECIMALS = 9;

// VRE Liberation Day: July 18, 2028 00:00:00 UTC
const VRE_LIBERATION_DATE = new Date('2028-07-18T00:00:00Z');
const VRE_LIBERATION_TIMESTAMP = 1842249600;

const App = () => {
    // --- Wallet Adapter Hooks ---
    const { publicKey, signTransaction, connected, connecting, disconnect } = useWallet();
    const { connection } = useConnection();

    // --- Price Hook ---
    const { solPrice, calculateVREPurchase, VRE_PRICE_USD, loading: priceLoading } = useSOLPrice();

    // --- State Management ---
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [firebaseStatus, setFirebaseStatus] = useState('Connecting to Firebase...');
    const [purchaseAmount, setPurchaseAmount] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Ready to begin.');
    const [userPurchases, setUserPurchases] = useState([]);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [timeToLiberation, setTimeToLiberation] = useState('');
    const [showAllTransactions, setShowAllTransactions] = useState(false);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

    // Helper function to truncate long IDs
    const truncateId = (id, startLength = 3, endLength = 4) => {
        if (!id || id.length <= startLength + endLength + 3) return id;
        return `${id.substring(0, startLength)}...${id.substring(id.length - endLength)}`;
    };

    // --- Firebase Initialization with Wallet-Based Auth ---
    useEffect(() => {
        if (!firebaseConfig.apiKey) {
            setFirebaseStatus("Firebase config is missing.");
            console.error("Firebase config is missing.");
            return;
        }

        const app = initializeApp(firebaseConfig);
        const dbInstance = getFirestore(app);
        setDb(dbInstance);

        // Initialize Firebase without authentication initially
        setFirebaseStatus("Firebase initialized. Connect wallet to load purchases.");
        console.log("🔥 Firebase initialized. Waiting for wallet connection...");

    }, []); // Empty dependency array to run only once

    // --- Wallet-Based Authentication and Data Loading ---
    useEffect(() => {
        let unsubscribeFirestore = () => {};

        if (connected && publicKey && db) {
            // Use wallet public key as user ID (deterministic across devices)
            const walletUserId = publicKey.toString();
            setUserId(walletUserId);
            setFirebaseStatus(`Database Connected: ${truncateId(walletUserId)}`);
            console.log("🔐 Wallet-based user ID:", walletUserId);
            console.log("👛 Wallet address:", publicKey.toString());

            // Set up Firestore listener using wallet address as user ID
            console.log("📱 App ID being used:", appId);
            console.log("🔍 Full Firestore path:", `artifacts/${appId}/users/${walletUserId}/purchases`);

            const purchasesColRef = collection(db, `artifacts/${appId}/users/${walletUserId}/purchases`);
            const q = query(purchasesColRef);

            unsubscribeFirestore = onSnapshot(q, (snapshot) => {
                console.log("🔥 Firestore query executed for wallet:", truncateId(walletUserId));
                console.log("📄 Documents found:", snapshot.size);
                const purchases = [];
                snapshot.forEach((doc) => {
                    console.log("📦 Found purchase:", doc.id, doc.data());
                    purchases.push({ id: doc.id, ...doc.data() });
                });
                console.log("✅ Total purchases loaded:", purchases.length);
                setUserPurchases(purchases);
                setIsLoadingTransactions(false);
            }, (error) => {
                console.error("❌ Error with Firestore listener:", error);
                console.error("🔍 Query path was:", `artifacts/${appId}/users/${walletUserId}/purchases`);
                setFirebaseStatus("Error loading purchases. See console.");
                setIsLoadingTransactions(false);
            });

        } else if (!connected || !publicKey) {
            // Wallet disconnected - clear user data
            setUserId(null);
            setUserPurchases([]);
            setIsLoadingTransactions(true);
            setFirebaseStatus("Connect wallet to view purchases.");
            console.log("👛 Wallet disconnected. User data cleared.");
            unsubscribeFirestore(); // Stop listening to Firestore
        }

        return () => {
            unsubscribeFirestore();
        };
    }, [connected, publicKey, db]); // Depend on wallet connection state

    // --- Wallet Status Update ---
    useEffect(() => {
        if (connected && publicKey) {
            setStatusMessage(`Wallet Connected: ${truncateId(publicKey.toString(), 4, 4)}`);
        } else if (connecting) {
            setStatusMessage('Connecting to wallet...');
        } else {
            setStatusMessage('Please connect your wallet to continue.');
        }
    }, [connected, publicKey, connecting]);

    // --- Liberation Day Countdown ---
    useEffect(() => {
        const updateLiberation = () => {
            setTimeToLiberation(getTimeToLiberation());
        };
        
        updateLiberation(); // Initial update
        const interval = setInterval(updateLiberation, 1000); // Update every second
        
        return () => clearInterval(interval);
    }, []);

    // --- Core Functions ---
    const getWalletStatus = () => {
        if (connected && publicKey) {
            return `Wallet Connected: ${truncateId(publicKey.toString(), 4, 4)}`;
        } else if (connecting) {
            return 'Connecting to wallet...';
        } else {
            return 'Click "Select Wallet" to connect your wallet.';
        }
    };

    // --- MoonPay Integration ---
    const handleMoonPayPayment = async () => {
        if (!connected || !publicKey) {
            alert('Please connect your wallet first');
            return;
        }

        if (!purchaseAmount || purchaseAmount <= 0) {
            alert('Please enter a valid amount first');
            return;
        }

        // MoonPay widget URL configuration - SOL goes to treasury, VRE delivered automatically
        const treasuryWallet = 'ASvW5fhNX7abbWKsyKt4XRzC2QDnmh8VykeyiWgj7HgU'; // Your treasury wallet
        const moonPayUrl = new URL('https://buy-sandbox.moonpay.com');
        moonPayUrl.searchParams.set('apiKey', 'pk_test_lm3GB5jn6lWY4Zjqd8QKrEWithtLXLNG');
        moonPayUrl.searchParams.set('currencyCode', 'SOL');
        moonPayUrl.searchParams.set('walletAddress', treasuryWallet); // SOL goes to your treasury
        moonPayUrl.searchParams.set('colorCode', '#9945FF');
        moonPayUrl.searchParams.set('redirectURL', window.location.href);
        moonPayUrl.searchParams.set('baseCurrencyAmount', (purchaseAmount * 0.20).toString());
        moonPayUrl.searchParams.set('externalCustomerId', publicKey.toString()); // Track user for VRE delivery

        setStatusMessage('Opening MoonPay payment window...');

        // Record the pending MoonPay purchase
        if (db && userId) {
            const pendingId = `moonpay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const docPath = `artifacts/${appId}/users/${userId}/moonpay_pending/${pendingId}`;
            await setDoc(doc(db, docPath), {
                tokens_requested: purchaseAmount,
                usd_amount: purchaseAmount * 0.20,
                user_wallet: publicKey.toString(),
                treasury_wallet: treasuryWallet,
                status: 'pending',
                created_at: new Date().toISOString(),
                moonpay_external_id: publicKey.toString()
            });
        }

        // Open MoonPay in a new window
        const moonPayWindow = window.open(
            moonPayUrl.toString(),
            'moonpay',
            'width=420,height=700,scrollbars=yes,resizable=yes'
        );

        // Listen for completion
        const checkClosed = setInterval(() => {
            if (moonPayWindow.closed) {
                clearInterval(checkClosed);
                setStatusMessage('MoonPay window closed. If you completed the purchase, VRE tokens will be delivered automatically within 5 minutes.');
            }
        }, 1000);
    };

    const handleCryptoPayment = async (crypto) => {
        if (!connected || !publicKey) {
            setStatusMessage('Please connect your wallet to continue.');
            return;
        }

        const amountToBuy = parseFloat(purchaseAmount);
        if (amountToBuy <= 0 || isNaN(amountToBuy)) {
            setStatusMessage('Please enter a valid amount.');
            return;
        }

        if (!solPrice) {
            setStatusMessage('Please wait for SOL price to load.');
            return;
        }

        try {
            // Calculate purchase details
            const purchaseDetails = calculateVREPurchase(amountToBuy);
            
            setStatusMessage(`Starting ${crypto} transaction for ${amountToBuy} VRE ($${purchaseDetails.usd.toFixed(2)})...`);
            const { PublicKey, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

            // SOL payment to treasury (your personal wallet)
            const treasuryWallet = new PublicKey('ASvW5fhNX7abbWKsyKt4XRzC2QDnmh8VykeyiWgj7HgU'); // Mainnet treasury wallet
            const lamportsToSend = Math.floor(purchaseDetails.sol * LAMPORTS_PER_SOL);
            
            const transaction = new Transaction().add(
                (await import('@solana/web3.js')).SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: treasuryWallet,
                    lamports: lamportsToSend,
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signedTransaction = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());
            await connection.confirmTransaction({
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
            }, 'confirmed');

            setStatusMessage(`Payment successful! Paid ${purchaseDetails.sol.toFixed(6)} SOL for ${amountToBuy} VRE tokens. 🎉 Your VRE tokens will appear in your wallet within 5 minutes!`);

            // Record purchase in Firebase
            if (db && userId) {
                const docPath = `artifacts/${appId}/users/${userId}/purchases/${signature}`;
                await setDoc(doc(db, docPath), {
                    tokens_bought: amountToBuy,
                    currency: crypto,
                    solana_tx_id: signature,
                    wallet_address: publicKey.toString(), // Store wallet address for tracking
                    purchase_date: new Date().toISOString(),
                    unlock_date: VRE_LIBERATION_DATE.toISOString(), // Global liberation date
                    liberation_date: '2028-07-18T00:00:00Z', // VRE Liberation Day
                    vre_mint_address: VRE_MINT_ADDRESS,
                    status: 'locked', // tokens locked until Liberation Day
                    usd_price: purchaseDetails.usd,
                    sol_paid: purchaseDetails.sol,
                    sol_price_at_purchase: solPrice
                });
                // Show initial pending message
                setStatusMessage(
                    <div className="space-y-2">
                        <div>✅ Payment complete! VRE tokens reserved until:</div>
                        <div className="text-purple-400 font-bold">Liberation Day (July 18, 2028).</div>
                        <div className="text-sm text-yellow-400">⏳ VRE tokens being delivered automatically...</div>
                        <div className="text-xs text-gray-500">Check transaction history below for delivery confirmation</div>
                        <div>
                            SOL Payment: 
                            <a 
                                href={`https://solscan.io/tx/${signature}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline ml-1"
                            >
                                {signature.substring(0, 5)}...{signature.substring(signature.length - 6)}
                            </a>
                        </div>
                        <div className="text-xs text-gray-400">
                            💡 Your VRE tokens are delivered and appear in your wallet as frozen until Liberation Day. 
                            They are safely locked on-chain until July 18, 2028.
                        </div>
                    </div>
                );
                
                // Start polling for VRE delivery confirmation
                pollForVREDelivery(signature, amountToBuy);
            } else {
                setStatusMessage('Transaction successful, but could not save to database. Please connect your wallet.');
            }

        } catch (error) {
            console.error("Error during crypto payment:", error);
            // Show specific error details for debugging
            const errorMessage = error.message || error.toString();
            setStatusMessage(`Transaction error: ${errorMessage}. Please check console for details.`);
        }
    };

    
    // Function to poll for VRE delivery confirmation
    const pollForVREDelivery = async (solSignature, vreAmount) => {
        let attempts = 0;
        const maxAttempts = 20; // Poll for up to 1 minute (3s x 20)
        
        const poll = async () => {
            attempts++;
            
            try {
                // Check Firebase for VRE delivery signature
                const response = await fetch('https://vrecoin-default-rtdb.firebaseio.com/purchases.json');
                const data = await response.json();
                
                if (data) {
                    // Find our transaction by SOL signature
                    for (const [key, purchase] of Object.entries(data)) {
                        if (purchase.solana_tx_id === solSignature && purchase.vre_delivery_signature) {
                            // Found the VRE delivery signature!
                            console.log('✅ Found VRE delivery confirmation:', purchase.vre_delivery_signature);
                            updateMessageWithVREDelivery(solSignature, purchase.vre_delivery_signature, vreAmount);
                            return;
                        }
                    }
                }
                
                // Continue polling if not found and within attempts limit
                if (attempts < maxAttempts) {
                    console.log(`🔍 Polling for VRE delivery... attempt ${attempts}/${maxAttempts}`);
                    setTimeout(poll, 3000); // Poll every 3 seconds
                } else {
                    console.log('⚠️ VRE delivery polling timeout - check may be needed');
                }
            } catch (error) {
                console.log('Polling for VRE delivery:', error.message);
                if (attempts < maxAttempts) {
                    setTimeout(poll, 3000);
                }
            }
        };
        
        // Start polling after a 2-second delay
        setTimeout(poll, 2000);
    };
    
    // Function to update the message with VRE delivery confirmation
    const updateMessageWithVREDelivery = (solSignature, vreSignature, vreAmount) => {
        setStatusMessage(
            <div className="space-y-2">
                <div>✅ Payment complete! VRE tokens reserved until:</div>
                <div className="text-purple-400 font-bold">Liberation Day (July 18, 2028).</div>
                <div className="text-sm text-green-400">✅ VRE tokens delivered successfully!</div>
                <div>
                    SOL Payment: 
                    <a 
                        href={`https://solscan.io/tx/${solSignature}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline ml-1"
                    >
                        {solSignature.substring(0, 5)}...{solSignature.substring(solSignature.length - 6)}
                    </a>
                </div>
                <div>
                    VRE Delivery: 
                    <a 
                        href={`https://solscan.io/tx/${vreSignature}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-400 hover:text-green-300 underline ml-1"
                    >
                        {vreSignature.substring(0, 5)}...{vreSignature.substring(vreSignature.length - 6)}
                    </a>
                </div>
                <div className="text-xs text-gray-400">
                    💡 Your {vreAmount} VRE tokens are delivered and appear in your wallet as frozen until Liberation Day. 
                    They are safely locked on-chain until July 18, 2028.
                </div>
            </div>
        );
    };

    const getTimeToLiberation = () => {
        const timeLeft = VRE_LIBERATION_DATE.getTime() - new Date().getTime();
        if (timeLeft <= 0) return "🎉 VRE LIBERATION DAY - Tokens Unlocked!";
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        return `${days}d ${hours}h ${minutes}m ${seconds}s until Liberation Day`;
    };

    const claimVRETokens = async (purchase) => {
        if (!connected || !publicKey) {
            setStatusMessage('Please connect your wallet to claim tokens.');
            return;
        }

        try {
            setStatusMessage('Preparing VRE token claim...');
            const { PublicKey } = await import('@solana/web3.js');
            const { getOrCreateAssociatedTokenAccount, transfer, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

            // Note: This is a placeholder. In production, you'd need a backend service
            // with authority over the VRE mint to actually mint/transfer tokens
            setStatusMessage('Token claiming functionality requires backend integration. Contact support.');
            
        } catch (error) {
            console.error("Error claiming tokens:", error);
            setStatusMessage('Error claiming tokens. Please try again later.');
        }
    };

    // --- Component JSX ---
    return (
        <>
            <Head>
                <title>VRE - Virtual Reality Economics | Decentralized Creator Economy</title>
                <meta name="description" content="Join the VRE ecosystem - a decentralized platform empowering creators, investors, and developers on Solana blockchain. Liberation Day: July 18, 2028." />

                {/* Open Graph Meta Tags */}
                <meta property="og:title" content="VRE - Virtual Reality Economics | Decentralized Creator Economy" />
                <meta property="og:description" content="Join the VRE ecosystem - a decentralized platform empowering creators, investors, and developers on Solana blockchain. Liberation Day: July 18, 2028." />
                <meta property="og:image" content="https://vrecoin.com/favicon.png" />
                <meta property="og:url" content="https://vrecoin.com" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="VRE - Virtual Reality Economics" />

                {/* Twitter Card Meta Tags */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:site" content="@VREconomics" />
                <meta name="twitter:title" content="VRE - Virtual Reality Economics | Decentralized Creator Economy" />
                <meta name="twitter:description" content="Join the VRE ecosystem - a decentralized platform empowering creators, investors, and developers on Solana blockchain. Liberation Day: July 18, 2028." />
                <meta name="twitter:image" content="https://vrecoin.com/favicon.png" />

                {/* Additional Meta Tags */}
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="theme-color" content="#9945FF" />
                <link rel="canonical" href="https://vrecoin.com" />

                {/* Existing favicon tags */}
                <link rel="icon" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/favicon.png" />
                <link rel="shortcut icon" href="/favicon.png" />
            </Head>

            <div className="bg-[#000000] text-white font-sans antialiased">
            {/* Background Gradient */}
            <div className="fixed top-0 left-0 w-full h-full -z-10">
                <div className="absolute top-0 left-0 w-full h-[1200px] bg-gradient-to-br from-[#9945FF] via-transparent to-[#14F195] opacity-20 blur-[100px] transform -translate-x-1/4 -translate-y-1/4"></div>
                <div className="absolute w-[800px] h-[800px] bg-purple-500 rounded-full blur-[200px] opacity-20 left-1/4 top-1/4 -translate-x-1/2 -translate-y-1/2 slow-pulse-1"></div>
                <div className="absolute w-[800px] h-[800px] bg-blue-500 rounded-full blur-[200px] opacity-20 right-1/4 bottom-1/4 translate-x-1/2 translate-y-1/2 slow-pulse-2"></div>
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-gray-800">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-6">
                        <a href="#hero" className="flex items-center">
                            <img src="/favicon.png" alt="VRE" className="w-8 h-8" />
                        </a>
                        <SOLPriceTicker />
                    </div>
                    <nav className="hidden md:flex items-center space-x-8">
                        <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
                        <a href="#tokenomics" className="text-gray-300 hover:text-white transition-colors">Tokenomics</a>
                        <a href="#roadmap" className="text-gray-300 hover:text-white transition-colors">Roadmap</a>
                        <a href="#ico" className="text-gray-300 hover:text-white transition-colors">Token Sale</a>
                        <a href="/whitepaper" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Whitepaper</a>
                    </nav>
                    <div className="hidden md:flex items-center space-x-4">
                        <button onClick={() => window.location.href = '/login'} className="bg-white/10 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors">
                            Login
                        </button>
                    </div>
                    <div className="md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
                            <svg className={`lucide lucide-menu ${isMobileMenuOpen ? 'hidden' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
                            <svg className={`lucide lucide-x ${isMobileMenuOpen ? '' : 'hidden'}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                        </button>
                    </div>
                </div>
                <div className={`md:hidden ${isMobileMenuOpen ? '' : 'hidden'} bg-black/80 backdrop-blur-lg`}>
                    <nav className="flex flex-col items-center space-y-4 py-6">
                        <a onClick={() => setIsMobileMenuOpen(false)} href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
                        <a onClick={() => setIsMobileMenuOpen(false)} href="#tokenomics" className="text-gray-300 hover:text-white transition-colors">Tokenomics</a>
                        <a onClick={() => setIsMobileMenuOpen(false)} href="#roadmap" className="text-gray-300 hover:text-white transition-colors">Roadmap</a>
                        <a onClick={() => setIsMobileMenuOpen(false)} href="#ico" className="text-gray-300 hover:text-white transition-colors">Token Sale</a>
                        <a onClick={() => setIsMobileMenuOpen(false)} href="/whitepaper" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Whitepaper</a>
                        <button onClick={() => window.location.href = '/login'} className="bg-white/10 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors">
                            Login
                        </button>
                    </nav>
                </div>
            </header>

            <main className="container mx-auto px-6 relative z-10">
                {/* Hero Section */}
                <section id="hero" className="min-h-screen flex flex-col justify-center items-center text-center pt-20">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-6 leading-tight">
                        The Future of
                        <br />
                        <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                            Virtual Reality Economics
                        </span>
                    </h1>
                    <p className="max-w-2xl text-lg md:text-xl text-gray-400 mb-8">
                        VRE is a decentralized, high-performance ecosystem powering the next generation of virtual worlds, metaverses, and digital economies.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <a href="#ico" className="w-full sm:w-auto bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-bold px-8 py-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center">
                            Token Sale <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right ml-2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                        </a>
                        <a href="/whitepaper" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto bg-white/10 border border-gray-700 text-white font-medium px-8 py-4 rounded-lg hover:bg-white/20 transition-colors inline-block text-center">
                            White Paper
                        </a>
                    </div>
                </section>

                {/* Features Section */}
                <section id="about" className="py-20">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">Built for the Metaverse</h2>
                        <p className="max-w-xl mx-auto text-gray-400 mt-4">
                            VRE provides the infrastructure for developers and creators to build immersive, scalable, and economically robust virtual experiences.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="bg-white/5 border border-gray-800 p-6 rounded-2xl hover:bg-white/10 transition-colors transform hover:-translate-y-1">
                            <div className="mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap text-[#14F195]"><path d="M4 12h16L12 2l-8 10h16z"></path><path d="M16 12h-8L12 22l-8-10h16z"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Blazing Fast</h3>
                            <p className="text-gray-400">Experience near-instant transaction finality, crucial for seamless in-world interactions and asset trading.</p>
                        </div>
                        <div className="bg-white/5 border border-gray-800 p-6 rounded-2xl hover:bg-white/10 transition-colors transform hover:-translate-y-1">
                            <div className="mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe text-[#9945FF]"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20"></path><path d="M2 12h20"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Massively Scalable</h3>
                            <p className="text-gray-400">Our network is designed to support millions of concurrent users and transactions, ensuring your virtual world never lags.</p>
                        </div>
                        <div className="bg-white/5 border border-gray-800 p-6 rounded-2xl hover:bg-white/10 transition-colors transform hover:-translate-y-1">
                            <div className="mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cpu text-[#14F195]"><rect x="5" y="5" width="14" height="14" rx="2"></rect><path d="M9 19V5"></path><path d="M15 19V5"></path><path d="M5 9h14"></path><path d="M5 15h14"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Decentralized Core</h3>
                            <p className="text-gray-400">True ownership and governance are in the hands of the community, creating a fair and transparent digital economy.</p>
                        </div>
                        <div className="bg-white/5 border border-gray-800 p-6 rounded-2xl hover:bg-white/10 transition-colors transform hover:-translate-y-1">
                            <div className="mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock text-[#9945FF]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Secure by Design</h3>
                            <p className="text-gray-400">Built with top-tier security protocols to protect user assets and ensure the integrity of the virtual economy.</p>
                        </div>
                    </div>
                </section>

                {/* Tokenomics Section */}
                <section id="tokenomics" className="py-20 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">VRE Tokenomics</h2>
                    <p className="max-w-xl mx-auto text-gray-400 mb-12">
                        A balanced and sustainable economic model designed for long-term growth, value preservation and utility within the VRE ecosystem.
                    </p>
                    <div className="max-w-4xl mx-auto bg-black/20 border border-gray-800 rounded-2xl p-8">
                        <div className="w-full h-80 bg-gray-900/30 rounded-lg p-6">
                            <TokenomicsChart />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-8 text-left">
                            <div>
                                <p className="text-gray-400 text-sm">Total Supply</p>
                                <p className="text-2xl font-bold">250,000,000</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Token Ticker</p>
                                <p className="text-2xl font-bold">$VRE</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Network</p>
                                <p className="text-2xl font-bold">Solana</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Contract</p>
                                <a
                                    href="https://solscan.io/token/FJHQH4WTDukwyeFov2H7U9GZSiy4PPYLeuMGpbCujZd9"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-2xl font-bold truncate text-[#14F195] hover:text-[#12e3e6] transition-colors cursor-pointer"
                                >
                                    FJHQ...jZd9
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Smart Contract Features */}
                <section className="py-12 bg-gradient-to-r from-purple-900/10 to-blue-900/10 border-t border-gray-800">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 text-white">VRE Liberation Protocol</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
                                <div className="mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-database text-purple-400">
                                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                        <path d="M3 5v14c0 3 4.03 6 9 6s9-3 9-6V5"></path>
                                        <path d="M3 12c0 3 4.03 6 9 6s9-3 9-6"></path>
                                    </svg>
                                </div>
                                <h4 className="font-bold text-lg mb-2">Pre-minted Pool</h4>
                                <p className="text-gray-400 text-sm">Contract holds a pool of pre-minted VRE tokens</p>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
                                <div className="mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-clock text-[#14F195]">
                                        <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"></path>
                                        <path d="M16 2v4"></path>
                                        <path d="M8 2v4"></path>
                                        <path d="M3 10h5"></path>
                                        <path d="M17.5 17.5 16 16.25V14"></path>
                                        <path d="M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"></path>
                                    </svg>
                                </div>
                                <h4 className="font-bold text-lg mb-2">Global Unlock Date</h4>
                                <p className="text-gray-400 text-sm">July 18, 2028 for all tokens (VRE Liberation Day)</p>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
                                <div className="mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye text-[#14F195]">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </div>
                                <h4 className="font-bold text-lg mb-2">Transfer Restrictions</h4>
                                <p className="text-gray-400 text-sm">Tokens are visible immediately in your wallet but locked until liberation day</p>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-6 hover:border-purple-500/50 transition-colors">
                                <div className="mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check text-purple-400">
                                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
                                        <path d="m9 12 2 2 4-4"></path>
                                    </svg>
                                </div>
                                <h4 className="font-bold text-lg mb-2">No Inflation</h4>
                                <p className="text-gray-400 text-sm">Fixed token supply prevents price dilution</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Roadmap Section */}
                <section id="roadmap" className="py-20">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">Roadmap to the Future</h2>
                        <p className="max-w-xl mx-auto text-gray-400 mt-4">
                            Our ambitious plan to build the foundational layer for the open metaverse.
                        </p>
                    </div>
                    <div className="relative max-w-2xl mx-auto">
                        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-800 transform -translate-x-1/2 hidden md:block"></div>
                        <div className="mb-12 relative md:mr-auto md:w-1/2">
                            <div className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-black border-2 border-[#14F195] rounded-full hidden md:block md:right-[-9px]"></div>
                            <div className="p-6 bg-white/5 border border-gray-800 rounded-2xl md:text-right md:pr-12">
                                <p className="text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text mb-1">Phase 1 - Foundation</p>
                                <p className="text-xs font-semibold mb-3 text-green-400">Completed</p>
                                <ul className="space-y-1 text-gray-300 md:text-right text-left">
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Token Launch on Solana</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Core Protocol Development</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Initial Community Building</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="mb-12 relative md:ml-auto md:w-1/2">
                            <div className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-black border-2 border-[#14F195] rounded-full hidden md:block md:left-[-9px]"></div>
                            <div className="p-6 bg-white/5 border border-gray-800 rounded-2xl md:pl-12">
                                <p className="text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text mb-1">Phase 2 - Ecosystem Growth</p>
                                <p className="text-xs font-semibold mb-3 text-yellow-400">In Progress</p>
                                <ul className="space-y-1 text-gray-300 md:text-left text-left">
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>First VR World Integration</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Developer SDK Release</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>NFT Marketplace Launch</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="mb-12 relative md:mr-auto md:w-1/2">
                            <div className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-black border-2 border-[#14F195] rounded-full hidden md:block md:right-[-9px]"></div>
                            <div className="p-6 bg-white/5 border border-gray-800 rounded-2xl md:text-right md:pr-12">
                                <p className="text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text mb-1">Phase 3 - Decentralization</p>
                                <p className="text-xs font-semibold mb-3 text-gray-400">Upcoming</p>
                                <ul className="space-y-1 text-gray-300 md:text-right text-left">
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>On-chain Governance</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Staking & Validator Program</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Cross-chain Bridges</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="mb-12 relative md:ml-auto md:w-1/2">
                            <div className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-black border-2 border-[#14F195] rounded-full hidden md:block md:left-[-9px]"></div>
                            <div className="p-6 bg-white/5 border border-gray-800 rounded-2xl md:pl-12">
                                <p className="text-sm font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text mb-1">Phase 4 - Mass Adoption</p>
                                <p className="text-xs font-semibold mb-3 text-gray-400">Future</p>
                                <ul className="space-y-1 text-gray-300 md:text-left text-left">
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Mainstream Metaverse Partnerships</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Mobile VR Client</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 mt-1 text-[#14F195]">&#10003;</span>
                                        <span>Global Expansion</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ICO Section */}
                <section id="ico" className="py-20 text-center">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">VRE Token Sale</h2>
                        <p className="max-w-xl mx-auto text-gray-400 mt-4">
                            Secure your VRE tokens with a lock-up period for all buyers.
                        </p>
                    </div>
                    <div className="relative max-w-xl w-full mx-auto bg-black/20 p-8 rounded-2xl shadow-lg border border-gray-800 backdrop-blur-md">
                        {/* State Section */}
                        <div className="mb-6 p-4 bg-gray-800 rounded-xl text-center border border-gray-700">
                            <h2 className="text-xl font-semibold mb-2">System Status</h2>
                            <p id="firebase-status" className="text-sm text-gray-400">{firebaseStatus}</p>
                            <p id="wallet-status" className="text-sm text-gray-400 mt-1">{getWalletStatus()}</p>
                            <div className="mt-4 flex justify-center">
                                <WalletButton className="!bg-gradient-to-r !from-[#9945FF] !to-[#14F195] hover:!from-[#8b3dff] hover:!to-[#12e3e6] !text-black !font-bold !py-3 !px-4 !rounded-xl !transition-transform !transform hover:!scale-105 !shadow-md" />
                            </div>
                            {userId && <p className="text-xs text-gray-500 text-center mt-2">Wallet ID: {truncateId(userId)} • Cross-device history enabled</p>}
                        </div>

                        {/* Purchase Section */}
                        <div className="p-6 bg-gray-800 rounded-xl shadow-inner mb-6 border border-gray-700">
                            <h2 className="text-2xl font-bold mb-2 text-center text-gray-200">Buy VRE Tokens</h2>
                            <div className="text-center mb-4 p-3 bg-gray-700 rounded-lg">
                                <p className="text-sm text-gray-300">
                                    Current Rate: <span className="text-green-400 font-bold">1 VRE = $0.20 USD</span>
                                    {solPrice && (
                                        <span className="text-gray-400 text-xs ml-2">
                                            (≈ {(0.20/solPrice).toFixed(6)} SOL)
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Token Contract: {VRE_MINT_ADDRESS.slice(0,8)}...{VRE_MINT_ADDRESS.slice(-8)}</p>
                                <p className="text-xs text-yellow-400 mt-1">🔒 Locked until <strong>VRE Liberation Day: July 18, 2028</strong></p>
                            </div>
                            <div className="flex flex-col space-y-4">
                                <div>
                                    <input
                                        id="amount-input"
                                        type="number"
                                        placeholder="Amount of VRE tokens"
                                        value={purchaseAmount}
                                        onChange={(e) => setPurchaseAmount(e.target.value)}
                                        className="w-full p-4 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    />
                                    {purchaseAmount > 0 && solPrice && (
                                        <div className="mt-2 p-3 bg-gray-700 rounded-lg text-center">
                                            <div className="text-lg font-bold text-green-400">
                                                Total: ${(purchaseAmount * 0.20).toFixed(2)} USD
                                            </div>
                                            <div className="text-sm text-gray-300">
                                                You will pay: <span className="font-bold text-yellow-400">{(purchaseAmount * 0.20 / solPrice).toFixed(6)} SOL</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                SOL Price: ${solPrice.toFixed(2)} USD
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleCryptoPayment('SOL')} className="bg-white/10 border border-gray-700 text-white font-medium py-3 px-4 rounded-lg hover:bg-white/20 transition-colors w-full">
                                    Pay with SOL
                                </button>

                                {/* OR Divider */}
                                <div className="flex items-center my-4">
                                    <div className="flex-1 border-t border-gray-600"></div>
                                    <span className="px-3 text-gray-400 text-sm font-medium">OR</span>
                                    <div className="flex-1 border-t border-gray-600"></div>
                                </div>

                                {/* Second Payment Button */}
                                <button onClick={handleMoonPayPayment} className="bg-white/10 border border-gray-700 text-white font-medium py-3 px-4 rounded-lg hover:bg-white/20 transition-colors w-full">
                                    Pay with Card (MoonPay)
                                </button>
                            </div>
                        </div>

                        {/* User Purchases Panel */}
                        <div className="p-6 bg-gray-800 rounded-xl shadow-inner border border-gray-700">
                            <h2 className="text-2xl font-bold mb-4 text-center text-gray-200">Your Token Purchases</h2>
                            <div id="user-purchases-panel">
                                {!connected ? (
                                    <div className="text-center text-gray-400">
                                        <div className="mb-3">
                                            <svg className="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-lg font-medium text-gray-300 mb-2">Connect Your Wallet</p>
                                        <p className="text-sm">Connect your wallet to view your token purchases and transaction history.</p>
                                    </div>
                                ) : isLoadingTransactions ? (
                                    <div className="text-center text-gray-400">
                                        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-purple-400 rounded-full mb-2" role="status" aria-label="loading"></div>
                                        <p>Loading your purchases...</p>
                                    </div>
                                ) : userPurchases.length === 0 ? (
                                    <p className="text-center text-gray-400">You haven't made any purchases yet.</p>
                                ) : (
                                    userPurchases.slice(0, showAllTransactions ? userPurchases.length : 1).map((purchase) => {
                                        const isUnlocked = VRE_LIBERATION_DATE.getTime() <= new Date().getTime();
                                        return (
                                            <div key={purchase.id} className="bg-gray-800 p-4 rounded-xl shadow-md mb-4 border border-gray-700">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-lg font-bold text-purple-400">Purchase of {purchase.tokens_bought} VRE</h3>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${purchase.status === 'locked' ? 'bg-yellow-600 text-yellow-200' : 'bg-green-600 text-green-200'}`}>
                                                        {purchase.status || 'locked'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400">Currency: {purchase.currency}</p>
                                                <p className="text-sm text-gray-400">Purchase Date: {new Date(purchase.purchase_date).toLocaleDateString()}</p>
                                                <p className="text-sm text-gray-400">🎉 Liberation Date: <span className="font-bold text-yellow-400">July 18, 2028</span></p>
                                                {purchase.usd_price && (
                                                    <p className="text-sm text-gray-400">Price Paid: ${purchase.usd_price.toFixed(2)} USD</p>
                                                )}
                                                {purchase.sol_paid && (
                                                    <p className="text-sm text-gray-400">SOL Paid: {purchase.sol_paid.toFixed(6)} SOL</p>
                                                )}
                                                {purchase.sol_price_at_purchase && (
                                                    <p className="text-xs text-gray-500">SOL Price: ${purchase.sol_price_at_purchase.toFixed(2)} at purchase</p>
                                                )}
                                                {purchase.vre_mint_address && (
                                                    <p className="text-xs text-gray-500 mt-1">VRE Token: {purchase.vre_mint_address}</p>
                                                )}
                                                <p className={`text-sm font-semibold mt-2 ${isUnlocked ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {timeToLiberation}
                                                </p>
                                                {isUnlocked && (
                                                    <button 
                                                        onClick={() => claimVRETokens(purchase)}
                                                        className="mt-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-2 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all"
                                                    >
                                                        Claim VRE Tokens
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                {userPurchases.length > 1 && !showAllTransactions && (
                                    <div className="text-center mt-4">
                                        <button 
                                            onClick={() => setShowAllTransactions(true)}
                                            className="bg-white/10 border border-gray-700 text-white font-medium py-2 px-6 rounded-lg hover:bg-white/20 transition-colors"
                                        >
                                            Show More... ({userPurchases.length - 1} more transactions)
                                        </button>
                                    </div>
                                )}
                                {showAllTransactions && userPurchases.length > 1 && (
                                    <div className="text-center mt-4">
                                        <button 
                                            onClick={() => setShowAllTransactions(false)}
                                            className="bg-white/10 border border-gray-700 text-white font-medium py-2 px-6 rounded-lg hover:bg-white/20 transition-colors"
                                        >
                                            Show Less
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Message */}
                        <div id="status-message" className="mt-6 p-4 text-center rounded-xl text-sm font-semibold text-gray-300 bg-gray-800 border border-gray-700">
                            {statusMessage}
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="py-20 bg-gradient-to-r from-purple-900/10 to-blue-900/10 border-t border-gray-800">
                    <div className="max-w-4xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">Frequently Asked Questions</h2>
                            <p className="max-w-2xl mx-auto text-gray-400">
                                Everything you need to know about the VRE tokens
                            </p>
                        </div>

                        <div className="space-y-6">
                            {/* FAQ Item 1 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    What is Liberation Day?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    Liberation Day (July 18, 2028) is when all VRE tokens become transferable simultaneously. Until then, tokens are frozen on-chain for value preservation and long-term ecosystem growth.
                                </p>
                            </div>

                            {/* FAQ Item 2 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    How do I receive my VRE tokens?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    VRE tokens are delivered instantly to your wallet after SOL payment confirmation. They appear as frozen tokens and will automatically unlock on Liberation Day without any action required.
                                </p>
                            </div>

                            {/* FAQ Item 3 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    What payment methods are accepted?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    We only accept SOL (Solana) payments for instant automated delivery. All payments are processed immediately via smart contracts on the Solana blockchain.
                                </p>
                            </div>

                            {/* FAQ Item 4 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    Can I trade VRE tokens before Liberation Day?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    No, VRE tokens are frozen until Liberation Day for all holders. This creates a fair ecosystem where everyone unlocks simultaneously, preventing early dumps and ensuring long-term value growth.
                                </p>
                            </div>

                            {/* FAQ Item 5 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    What happens to the VRE ecosystem during the lock period?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    Development continues actively during the lock period. Funds raised are used for platform development, partnerships, and ecosystem growth, preparing for a strong launch on Liberation Day.
                                </p>
                            </div>

                            {/* FAQ Item 6 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    What happens if I try to transfer VRE before Liberation Day?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    You will receive error 0x11 (Account is frozen). This is the blockchain's built-in protection preventing any transfers until Liberation Day. The smart contract enforces this automatically.
                                </p>
                            </div>

                            {/* FAQ Item 7 */}
                            <div className="bg-black/20 border border-gray-800 rounded-2xl p-6 hover:bg-black/30 transition-colors">
                                <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text">
                                    Is my investment secure?
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    Yes, VRE tokens are secured on the Solana blockchain with immutable smart contracts. The freeze mechanism is built into the token itself, ensuring Liberation Day occurs exactly as programmed.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 mt-20">
                <div className="container mx-auto px-6 py-12 text-center text-gray-500">
                    <p className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-[#9945FF] to-[#14F195] text-transparent bg-clip-text mb-4">
                        VRE
                    </p>
                    <div className="flex justify-center mb-8">
                        <a href="https://x.com/VREconomics" className="hover:text-white" target="_blank">x.com/VREconomics</a>
                    </div>
                    <div className="space-y-4 mb-4">
                        <div className="flex flex-wrap justify-center gap-4">
                            <a href="/" className="text-[#14F195] hover:text-[#12e3e6]">Home</a>
                            <span className="text-gray-600">•</span>
                            <a href="/whitepaper" className="text-[#14F195] hover:text-[#12e3e6]">Whitepaper</a>
                            <span className="text-gray-600">•</span>
                            <a href="/#roadmap" className="text-[#14F195] hover:text-[#12e3e6]">Roadmap</a>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 text-sm">
                            <a href="/privacy-policy" className="text-gray-400 hover:text-[#14F195]">Privacy Policy</a>
                            <span className="text-gray-600">•</span>
                            <a href="/terms-of-service" className="text-gray-400 hover:text-[#14F195]">Terms of Service</a>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                            Built on Solana • Decentralized • Community Governed
                        </p>
                    </div>
                    <p>&copy; 2025 Virtual Reality Economics. All rights reserved.</p>
                    <p className="text-sm mt-2">This is not financial advice. Always do your own research.</p>
                </div>
            </footer>
            </div>
        </>
    );
};

export default App;
