const fs = require('fs');

async function simulateSecondary() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5001/api';
  const timestamp = Date.now();
  
  const ctx = {}; // context state
  
  console.log('=== Starting E2E Secondary & Admin Simulation ===\n');

  async function api(method, path, body = null, token = null) {
    const opts = { method, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, opts);
    let data;
    try { data = await res.json(); } catch(e) { data = null; }
    if (!res.ok) throw new Error(`[${method}] ${path} returned ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Register two new users 
    // -------------------------------------------------------------
    console.log('[1/4] Bootstrapping Users...');
    const emailAdmin = `admin_${timestamp}@example.com`;
    const emailUser = `user_${timestamp}@example.com`;
    
    await api('POST', '/auth/register', { email: emailAdmin, password: 'password123', displayName: 'Admin Dude' });
    await api('POST', '/auth/register', { email: emailUser, password: 'password123', displayName: 'Passive User' });
    
    const loginA = await api('POST', '/auth/login', { email: emailAdmin, password: 'password123' });
    const loginB = await api('POST', '/auth/login', { email: emailUser, password: 'password123' });
    
    ctx.adminToken = loginA.data.accessToken;
    ctx.adminId = loginA.data.user.id;
    
    ctx.userToken = loginB.data.accessToken;
    ctx.userId = loginB.data.user.id;

    // -------------------------------------------------------------
    // PHASE 1: Database Admin Privileges Setup
    // Admin promotion usually takes place securely, so we'll 
    // mock an explicit role update if there's no endpoint. 
    // Is there a route to self-promote or do we patch DB?
    // Let's first check if /auth/me returns roles.
    // -------------------------------------------------------------
    const profile = await api('GET', '/users/me', null, ctx.adminToken);
    console.log(`Initial Admin Role: ${profile.data.role}`);

  } catch (err) {
    console.error('\nE2E Failure:', err.message);
    process.exit(1);
  }
}

simulateSecondary();
