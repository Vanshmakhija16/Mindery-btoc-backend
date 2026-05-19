// config/paypal.js
// Direct PayPal REST API — no SDK dependency.
// Sandbox vs live is controlled by NODE_ENV.

import axios from "axios";

const isSandbox = process.env.NODE_ENV !== "production";

export const PAYPAL_BASE = isSandbox
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

console.log(`[PayPal] Mode: ${isSandbox ? "SANDBOX" : "LIVE"} | Base: ${PAYPAL_BASE}`);

// ── Get OAuth2 access token ───────────────────────────────────────────────────
export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;

    console.log("BACKEND CLIENT:", clientId);
  console.log("BACKEND SECRET STARTS:", secret?.slice(0, 5));
  
  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID or PAYPAL_SECRET missing from .env");
  }

  console.log(`[PayPal] Getting access token... clientId starts with: ${clientId.substring(0, 10)}...`);

  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");

  try {
    const res = await axios.post(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
      }
    );
    console.log(`[PayPal] Access token obtained successfully`);
    return res.data.access_token;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`[PayPal] Token fetch FAILED — HTTP ${status}`);
    console.error(`[PayPal] Response body:`, JSON.stringify(data || err.message));
    throw new Error(`PayPal auth failed (${status}): ${JSON.stringify(data)}`);
  }
}

// ── Create Order ──────────────────────────────────────────────────────────────
export async function createPayPalOrder({ cadPrice, doctorId, employeeId, isFirstSession }) {
  const token = await getPayPalAccessToken();

  console.log(`[PayPal] Creating order — CAD $${cadPrice} | doctorId: ${doctorId}`);

  try {
    const res = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "CAD",
              value: Number(cadPrice).toFixed(2),
            },
            custom_id: JSON.stringify({ doctorId, employeeId, cadPrice, isFirstSession }),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`[PayPal] Order created: ${res.data.id}`);
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`[PayPal] Create order FAILED — HTTP ${status}`);
    console.error(`[PayPal] Response body:`, JSON.stringify(data || err.message));
    throw new Error(`PayPal create order failed (${status}): ${JSON.stringify(data)}`);
  }
}

// ── Capture Order ─────────────────────────────────────────────────────────────
export async function capturePayPalOrder(orderID) {
  const token = await getPayPalAccessToken();

  console.log(`[PayPal] Capturing order: ${orderID}`);

  try {
    const res = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`[PayPal] Capture status: ${res.data.status}`);
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`[PayPal] Capture FAILED — HTTP ${status}`);
    console.error(`[PayPal] Response body:`, JSON.stringify(data || err.message));
    throw new Error(`PayPal capture failed (${status}): ${JSON.stringify(data)}`);
  }
}
