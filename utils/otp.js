/**
 * OTP Management Utility
 * Handles generation, storage, and verification of OTPs
 */

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Generate random 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP with expiration (10 minutes)
export const storeOTP = (phone, otp) => {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(phone, { otp, expiresAt });
  console.log(`✅ OTP stored for ${phone}: ${otp}`);
};

// Verify OTP
export const verifyOTP = (phone, providedOtp) => {
  const storedData = otpStore.get(phone);

  if (!storedData) {
    return { valid: false, message: "No OTP found for this phone" };
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, message: "OTP expired" };
  }

  if (storedData.otp !== providedOtp) {
    return { valid: false, message: "Invalid OTP" };
  }

  otpStore.delete(phone);
  return { valid: true, message: "OTP verified successfully" };
};

// Delete OTP (after successful verification or timeout)
export const deleteOTP = (phone) => {
  otpStore.delete(phone);
};

// Get OTP (for testing purposes only - remove in production)
export const getOTP = (phone) => {
  const data = otpStore.get(phone);
  if (!data) return null;
  return {
    otp: data.otp,
    expiresIn: Math.ceil((data.expiresAt - Date.now()) / 1000),
  };
};
