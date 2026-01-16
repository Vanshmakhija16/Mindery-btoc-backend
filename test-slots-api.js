/**
 * Test script for slot management endpoints
 * Tests: setSlotsForDate, getAvailabilityForDate, clearSlotsForDate
 */

const BASE_URL = "http://localhost:5000";

// Helper function to make requests
async function makeRequest(method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data,
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      data: { error: error.message },
    };
  }
}

// Test functions
async function testSlotManagement() {
  console.log("\n===== SLOT MANAGEMENT API TESTS =====\n");

  // You'll need to replace this with an actual doctor ID from your database
  const doctorId = "67851ca0e4c3c6fa4f5e4c1a"; // Replace with real ID
  const testDate = new Date().toISOString().split("T")[0];

  console.log(`Testing with Doctor ID: ${doctorId}`);
  console.log(`Test Date: ${testDate}\n`);

  // Test 1: Set slots for a date
  console.log("TEST 1: Setting slots for a specific date");
  console.log("-------------------------------------------");
  
  const slotsToSet = [
    { startTime: "09:00", endTime: "09:30" },
    { startTime: "09:30", endTime: "10:00" },
    { startTime: "10:00", endTime: "10:30" },
    { startTime: "14:00", endTime: "14:30" },
    { startTime: "14:30", endTime: "15:00" },
  ];

  const setResponse = await makeRequest("PATCH", `btoc/doctors/${doctorId}/slots`, {
    date: testDate,
    slots: slotsToSet,
  });

  console.log(`Status: ${setResponse.status}`);
  console.log(`Success: ${setResponse.success}`);
  console.log(`Response:`, JSON.stringify(setResponse.data, null, 2));
  console.log();

  // Test 2: Get availability for the date
  console.log("TEST 2: Getting availability for the specific date");
  console.log("---------------------------------------------------");
  
  const getResponse = await makeRequest("GET", `btoc/doctors/${doctorId}/availability?date=${testDate}`);
  
  console.log(`Status: ${getResponse.status}`);
  console.log(`Success: ${getResponse.success}`);
  console.log(`Response:`, JSON.stringify(getResponse.data, null, 2));
  console.log();

  // Test 3: Clear slots for the date
  console.log("TEST 3: Clearing slots for the specific date");
  console.log("-------------------------------------------");
  
  const clearResponse = await makeRequest("DELETE", `btoc/doctors/${doctorId}/slots/${testDate}`);
  
  console.log(`Status: ${clearResponse.status}`);
  console.log(`Success: ${clearResponse.success}`);
  console.log(`Response:`, JSON.stringify(clearResponse.data, null, 2));
  console.log();

  // Test 4: Verify slots are cleared
  console.log("TEST 4: Verifying slots are cleared");
  console.log("-----------------------------------");
  
  const verifyResponse = await makeRequest("GET", `btoc/doctors/${doctorId}/availability?date=${testDate}`);
  
  console.log(`Status: ${verifyResponse.status}`);
  console.log(`Success: ${verifyResponse.success}`);
  console.log(`Response:`, JSON.stringify(verifyResponse.data, null, 2));
  console.log();

  console.log("===== TESTS COMPLETED =====\n");
}

// Run tests
testSlotManagement().catch(console.error);
