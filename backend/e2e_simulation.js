async function simulate() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5001/api';
  
  const userA = { email: `alice_${Date.now()}@example.com`, pass: 'password123' };
  const userB = { email: `bob_${Date.now()}@example.com`, pass: 'password123' };
  
  const ctx = {}; // To store IDs and Tokens

  console.log('=== Starting System E2E Simulation ===\n');

  // Helper fetch function
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
    // PHASE 1: Auth & User Profiles
    // -------------------------------------------------------------
    console.log('[1/7] Registering Users...');
    await api('POST', '/auth/register', { email: userA.email, password: userA.pass, displayName: 'Alice' });
    await api('POST', '/auth/register', { email: userB.email, password: userB.pass, displayName: 'Bob' });
    
    console.log('Logging in Users...');
    const loginA = await api('POST', '/auth/login', { email: userA.email, password: userA.pass });
    const loginB = await api('POST', '/auth/login', { email: userB.email, password: userB.pass });
    ctx.tokenA = loginA.data.accessToken;
    ctx.idA = loginA.data.user.id;
    ctx.tokenB = loginB.data.accessToken;
    ctx.idB = loginB.data.user.id;

    console.log('[2/7] Adding Skills to Profiles...');
    // Alice offers JS, wants PY
    await api('POST', '/users/me/skills', { name: 'JavaScript', type: 'offer', proficiencyLevel: 'EXPERT' }, ctx.tokenA);
    await api('POST', '/users/me/skills', { name: 'Python', type: 'want', proficiencyLevel: 'BEGINNER' }, ctx.tokenA);

    // Bob offers PY, wants JS
    await api('POST', '/users/me/skills', { name: 'Python', type: 'offer', proficiencyLevel: 'EXPERT' }, ctx.tokenB);
    await api('POST', '/users/me/skills', { name: 'JavaScript', type: 'want', proficiencyLevel: 'BEGINNER' }, ctx.tokenB);

    // -------------------------------------------------------------
    // PHASE 2: Matching
    // -------------------------------------------------------------
    console.log('[3/7] Generating Match Results...');
    const matchesA = await api('GET', '/matches?strategy=skill', null, ctx.tokenA);
    const match = matchesA.data?.matches?.find(m => m.matchedUser.id === ctx.idB);
    
    if (!match) throw new Error('No match found between Alice and Bob!');
    ctx.matchId = match.matchId;
    console.log(`Matched! ID: ${ctx.matchId}`);

    // Wait, createSwap needs specific UserSkill IDs. 
    // We need to fetch Alice's mapped UserSkill IDs.
    const profileA = await api('GET', '/users/me', null, ctx.tokenA);
    const aliceOfferId = profileA.data.skills.find((s) => String(s.type).toLowerCase() === 'offer')?.id;
    
    const profileB = await api('GET', '/users/me', null, ctx.tokenB);
    const bobOfferId = profileB.data.skills.find((s) => String(s.type).toLowerCase() === 'offer')?.id;

    if (!aliceOfferId || !bobOfferId) {
      throw new Error('Unable to resolve offered skill IDs from user profiles');
    }

    // -------------------------------------------------------------
    // PHASE 3: Swaps Create & Accept
    // -------------------------------------------------------------
    console.log('[4/7] Initiating Swap...');
    const swapReq = await api('POST', '/swaps', {
      matchId: ctx.matchId,
      offeredSkillId: aliceOfferId,
      requestedSkillId: bobOfferId,
      terms: 'Teach me python, I teach you react'
    }, ctx.tokenA);
    ctx.swapId = swapReq.data.id;

    console.log('Accepting Swap (Bob)...');
    await api('POST', `/swaps/${ctx.swapId}/accept`, null, ctx.tokenB);

    // -------------------------------------------------------------
    // PHASE 4: Chats & Sessions
    // -------------------------------------------------------------
    console.log('[5/7] Scheduling Sessions and Chatting...');
    await api('POST', `/swaps/${ctx.swapId}/sessions`, {
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMins: 60,
      notes: 'First lesson'
    }, ctx.tokenB);
    
    // Test basic stats for sanity
    const statsA = await api('GET', '/swaps/stats', null, ctx.tokenA);
    console.log(`Alice ongoing Swaps: ${JSON.stringify(statsA.data)}`);

    // -------------------------------------------------------------
    // PHASE 5: Completion & Reviews
    // -------------------------------------------------------------
    console.log('[6/7] Completing the Swap...');
    await api('POST', `/swaps/${ctx.swapId}/complete`, null, ctx.tokenA);
    await api('POST', `/swaps/${ctx.swapId}/complete`, null, ctx.tokenB);

    console.log('[7/7] Leaving a Review...');
    await api('POST', `/swaps/${ctx.swapId}/reviews`, {
      rating: 5,
      comment: 'Bob was an excellent teacher!'
    }, ctx.tokenA);

    console.log('\n=== Simulation Finished Successfully! ===\n');
    process.exit(0);

  } catch (err) {
    console.error('\nE2E Failure:', err.message);
    process.exit(1);
  }
}

simulate();
