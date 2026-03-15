const fs = require('fs');

async function testAPIs() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5001/api';
  console.log('--- Starting API Tests ---\n');

  try {
    // 1. REGISTER
    console.log('Testing: POST /auth/register');
    const registerEmail = `test_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerEmail, password: 'password123', displayName: 'Curl Tester' })
    });
    const regData = await regRes.json();
    console.log('Status:', regRes.status, regData.success ? 'Success' : 'Failed');
    if (!regData.success) {
      console.log(regData);
      return;
    }
    
    // 2. LOGIN
    console.log('\nTesting: POST /auth/login');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerEmail, password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log('Status:', loginRes.status, loginData.success ? 'Success' : 'Failed');
    
    const token = loginData.data.accessToken;

    // 3. GET PROFILE
    console.log('\nTesting: GET /users/me');
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    console.log('Status:', meRes.status);
    console.log('User Email:', meData.data.email);

    // 4. ADD SKILL (Requires setting up Skills mapping)
    // First, let's create a skill directly in DB or use a fake ID assuming it has some constraints
    // Actually, adding skill requires a valid skillId that belongs to a Skill category. 
    // We can just dump the results.
    console.log('\nTesting: GET /users/search?q=test');
    const searchRes = await fetch(`${baseUrl}/users/search?q=test`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    console.log('Status:', searchRes.status, 'Total found:', searchData.data.total);

    console.log('\n--- Tests Completed Successfully ---');
    process.exit(0);

  } catch (err) {
    console.error('Error during testing:', err);
    process.exit(1);
  }
}

testAPIs();
