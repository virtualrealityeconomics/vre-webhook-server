# Railway Deployment Guide for MoonPay Integration

## 🎉 What's Ready

Your Railway service now handles MoonPay webhook requests and automatically delivers VRE tokens using your existing infrastructure!

## 📁 Files Created/Updated

- ✅ `moonpay-webhook-handler.js` - Express server for MoonPay webhooks
- ✅ `package.json` - Updated to start the webhook handler
- ✅ Uses your existing `ultimate-token-distributor.js` for VRE delivery
- ✅ Uses your existing `firebase-updater.js` for purchase tracking

## 🚀 Deploy to Railway

### 1. Upload to Railway

Upload these files to your Railway service:
- `moonpay-webhook-handler.js`
- Updated `package.json`
- All your existing files (`ultimate-token-distributor.js`, `firebase-updater.js`, etc.)

### 2. Set Railway Start Command

In Railway dashboard:
- Go to your service settings
- Set **Start Command**: `npm start`
- Or set **Main Command**: `node moonpay-webhook-handler.js`

### 3. Environment Variables

Make sure Railway has these environment variables:
- `PORT` (Railway sets this automatically)
- Any Solana/Firebase environment variables you already have

### 4. Get Your Railway URL

After deployment, Railway will give you a URL like:
```
https://your-service-name.railway.app
```

## 🔗 Update Frontend

Add your Railway URL to the frontend `.env.local`:

```bash
RAILWAY_WEBHOOK_URL="https://your-service-name.railway.app/webhook"
```

## 🧪 Test the Integration

### 1. Health Check
Visit: `https://your-service-name.railway.app/health`

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-30...",
  "service": "VRE MoonPay Webhook Handler"
}
```

### 2. Test MoonPay Flow

1. User clicks "Pay with Card (MoonPay)" on your site
2. MoonPay processes payment → SOL goes to treasury
3. MoonPay sends webhook to your site
4. Your site sends delivery request to Railway
5. Railway delivers VRE tokens automatically
6. User sees VRE in wallet!

## 🔄 How It Works

### Data Flow:
```
MoonPay Payment Complete
        ↓
Frontend receives webhook
        ↓
Frontend → Railway webhook
        ↓
Railway → ultimateDeliverVRE()
        ↓
VRE tokens delivered to user
        ↓
Firebase updated with delivery info
```

### Webhook Payload:
Your Railway service receives:
```json
{
  "source": "moonpay",
  "type": "vre_delivery_request",
  "user_wallet": "wallet_address",
  "vre_amount": 1000,
  "purchase_id": "moonpay_12345",
  "moonpay_transaction_id": "tx_id",
  "sol_received": 0.5,
  "usd_amount": 200.00
}
```

## 🎯 Benefits

✅ **Secure** - Treasury key stays in Railway (not frontend)
✅ **Proven** - Uses your existing VRE delivery system
✅ **Automatic** - No manual intervention needed
✅ **Reliable** - Same infrastructure as current SOL payments

## 📝 Next Steps

1. **Deploy** the webhook handler to Railway
2. **Get the Railway URL** and add to frontend
3. **Deploy** updated frontend
4. **Test** with small MoonPay transaction
5. **Go Live** 🚀

---

🎉 **Ready for one-click VRE purchases with credit cards!**