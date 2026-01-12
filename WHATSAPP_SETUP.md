# WhatsApp Integration Setup Guide

## Overview
This guide explains how to set up WhatsApp integration for:
- **OTP sending during signup**
- **Booking confirmations**
- **Booking reminders**
- **Cancellation notifications**

---

## Prerequisites

1. **Meta Business Account** (formerly Facebook)
2. **WhatsApp Business Account**
3. **Verified WhatsApp Phone Number**
4. **Access Token** with WhatsApp API permissions

---

## Step 1: Create Meta Business Account

1. Go to [Facebook Business](https://business.facebook.com)
2. Sign up or log in with your existing account
3. Create a new Business Account (or use existing one)
4. Save your Business Account ID

---

## Step 2: Set Up WhatsApp Business Account

1. In your Business Account, go to **WhatsApp**
2. Click **Start Now** or **Manage**
3. Create a WhatsApp Business Account
4. Complete the verification process:
   - Confirm your Business Name
   - Add a Business Category
   - Add Business Information

---

## Step 3: Get Phone Number & Access Token

### Get Phone Number ID:
1. In WhatsApp Business Account, go to **Phone Numbers**
2. Click on your phone number or add a new one
3. Copy the **Phone Number ID** (looks like: `112345678901234`)

### Create Access Token:
1. Go to **Settings** → **System Users**
2. Create a new System User with access to WhatsApp
3. Or use Personal Access Token from **Settings** → **User Tokens**
4. Make sure it has these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

---

## Step 4: Update Environment Variables

Edit `.env` file in the backend directory:

```env
WHATSAPP_PHONE_NUMBER_ID=112345678901234
WHATSAPP_ACCESS_TOKEN=EAABsbCS1iHgBAHyZ...
ENABLE_WHATSAPP=true
```

### Alternative: Testing Without Real WhatsApp

If you don't have WhatsApp credentials yet, you can still test the API:

```env
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
ENABLE_WHATSAPP=false
```

In this mode:
- OTP will be generated and printed in console logs
- Messages will show "WhatsApp not configured" but won't fail
- Useful for development/testing

---

## Step 5: Test the Integration

### Test OTP Sending

**Endpoint:** `POST /api/whatsapp/send-otp`

**Request:**
```json
{
  "phone": "9876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent successfully to WhatsApp",
  "phone": "3210"
}
```

**Response (Development Mode):**
```json
{
  "success": true,
  "message": "OTP generated (WhatsApp not configured)",
  "phone": "3210",
  "mode": "development"
}
```

### Test OTP Verification

**Endpoint:** `POST /api/whatsapp/verify-otp`

**Request:**
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "phone": "9876543210"
}
```

---

## API Endpoints

### 1. Send OTP
```
POST /api/whatsapp/send-otp
Body: { phone: "9876543210" }
```
Sends a 6-digit OTP to the user's WhatsApp

### 2. Verify OTP
```
POST /api/whatsapp/verify-otp
Body: { phone: "9876543210", otp: "123456" }
```
Verifies the OTP (expires after 10 minutes)

### 3. Resend OTP
```
POST /api/whatsapp/resend-otp
Body: { phone: "9876543210" }
```
Generates and sends a new OTP

---

## Integration in Signup Flow

### Current Implementation

The WhatsApp OTP endpoints are set up but **not yet integrated** into the signup flow. Here's what needs to be done:

**Frontend Changes Needed:**
1. Update signup form to ask for phone number
2. After user enters phone, call `/api/whatsapp/send-otp`
3. Show OTP input field
4. Call `/api/whatsapp/verify-otp` before final signup
5. Only complete signup if OTP is verified

**Example Flow:**
```
1. User fills form (name, email, phone, password)
2. Click "Sign Up" → POST /api/whatsapp/send-otp
3. Show OTP screen
4. User enters OTP → POST /api/whatsapp/verify-otp
5. If verified → POST /api/auth/signup (create account)
```

---

## Integration in Booking Flow

### Current Implementation ✅

WhatsApp booking confirmation is **automatically sent** when a booking is created:

1. User creates booking via `POST /api/bookingRoute`
2. System sends:
   - Email to doctor
   - Email to patient
   - **WhatsApp message to patient** (if phone provided)

### Booking Cancellation ✅

When a booking is cancelled via `DELETE /api/bookingRoute/:bookingId`:

1. System sends:
   - Cancellation email to patient
   - **WhatsApp cancellation notice to patient**
   - Cancellation email to doctor

---

## Message Templates

### OTP Message
```
Your Mindery verification code is *123456*. It will expire in 10 minutes. Do not share this code with anyone.
```

### Booking Confirmation
```
🎉 *Booking Confirmed!*

Your session with Dr. John is confirmed!

📅 *Date:* 2024-01-15
⏰ *Time:* 2:00 PM
📱 *Mode:* Video
💰 *Amount:* ₹500
📋 *Booking ID:* A1B2C3D4

📞 *Doctor Contact:* +91-9876543210

For any changes, reply to this message or contact support.

Thank you for choosing Mindery! 🙏
```

### Booking Cancellation
```
❌ *Booking Cancelled*

Your booking has been cancelled.

📋 *Booking ID:* A1B2C3D4
👨‍⚕️ *Doctor:* Dr. John
📅 *Session Date:* 2024-01-15

💰 *Refund Amount:* ₹500
The refund will be processed within 3-5 business days.

If you have any questions, please contact our support team.
```

---

## Troubleshooting

### Issue: "WhatsApp env variables missing"

**Solution:**
- Make sure `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set in `.env`
- Restart the backend server after changing `.env`

### Issue: "Invalid access token"

**Solution:**
- Verify the access token is still valid in Facebook Developer Panel
- Check if the token has expired (tokens have expiration dates)
- Create a new token if needed

### Issue: Messages not being sent

**Solution:**
1. Check server logs for error messages
2. Verify phone number format (should be 10 digits for India)
3. Ensure the recipient number is added to your WhatsApp verified list
4. Check WhatsApp Business Account status (must be active)

### Issue: Rate Limiting

**Solution:**
- Meta limits messages to 1000 per day for new accounts
- Wait 24 hours or request higher limit from Meta
- Cache OTPs to reduce API calls

---

## Production Considerations

1. **Use Environment Variables:** Never hardcode credentials
2. **Add Rate Limiting:** Prevent OTP spam (max 3 attempts per hour)
3. **Use Redis:** Store OTPs in Redis instead of memory for scalability
4. **Log Messages:** Keep logs of sent messages for compliance
5. **Error Handling:** Gracefully handle WhatsApp API failures
6. **Backup:** Have email fallback if WhatsApp fails
7. **Compliance:** Follow WhatsApp Business API terms of service

---

## Redis Setup (Optional but Recommended)

Instead of in-memory OTP storage, use Redis:

```bash
# Install redis package
npm install redis

# In utils/otp.js
import { createClient } from 'redis';

const client = createClient();
client.connect();

export const storeOTP = async (phone, otp) => {
  await client.setEx(phone, 600, otp); // 10 minutes
};

export const verifyOTP = async (phone, providedOtp) => {
  const storedOtp = await client.get(phone);
  if (storedOtp === providedOtp) {
    await client.del(phone);
    return { valid: true };
  }
  return { valid: false };
};
```

---

## Support

For issues or questions:
1. Check WhatsApp Business API documentation
2. Review server logs
3. Test endpoints with Postman
4. Contact Meta support for API issues
