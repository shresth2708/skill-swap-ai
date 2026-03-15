import { expect, test } from '@playwright/test';

const API_BASE_URL = globalThis.process?.env?.PW_API_URL || 'http://127.0.0.1:5001/api';

const unwrapBody = (payload) => payload?.data ?? payload;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiRequest(request, { method = 'GET', path, token, data } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await request.fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    data,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok() || payload?.success === false) {
    const message = payload?.error?.message
      || payload?.message
      || `${method} ${path} failed with status ${response.status()}`;
    throw new Error(message);
  }

  return unwrapBody(payload);
}

async function registerAndSeedUser(request, {
  displayName,
  email,
  password,
  offeredSkill,
  wantedSkill,
}) {
  const authData = await apiRequest(request, {
    method: 'POST',
    path: '/auth/register',
    data: {
      displayName,
      email,
      password,
    },
  });

  const token = authData?.accessToken;
  const refreshToken = authData?.refreshToken;
  const userId = authData?.user?.id;

  if (!token || !refreshToken || !userId) {
    throw new Error('Registration did not return auth tokens and user id');
  }

  await apiRequest(request, {
    method: 'POST',
    path: '/users/me/skills',
    token,
    data: {
      name: offeredSkill,
      type: 'offer',
      proficiencyLevel: 'EXPERT',
    },
  });

  await apiRequest(request, {
    method: 'POST',
    path: '/users/me/skills',
    token,
    data: {
      name: wantedSkill,
      type: 'want',
      proficiencyLevel: 'BEGINNER',
    },
  });

  const loginData = await apiRequest(request, {
    method: 'POST',
    path: '/auth/login',
    data: {
      email,
      password,
    },
  });

  const loginAccessToken = loginData?.accessToken;
  const loginRefreshToken = loginData?.refreshToken;

  if (!loginAccessToken || !loginRefreshToken) {
    throw new Error('Login after seeding did not return auth tokens');
  }

  return {
    id: userId,
    token: loginAccessToken,
    refreshToken: loginRefreshToken,
    displayName,
    email,
    password,
  };
}

function findMatchForUser(matches, targetUserId) {
  return matches.find((match) => {
    const candidateIds = [
      match?.matchedUser?.id,
      match?.user?.id,
      match?.userId,
      match?.userId1,
      match?.userId2,
    ].filter(Boolean);

    return candidateIds.includes(targetUserId);
  });
}

async function waitForMatch(request, token, targetUserId) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const payload = await apiRequest(request, {
      method: 'GET',
      path: '/matches?strategy=skill',
      token,
    });

    const matches = Array.isArray(payload) ? payload : (payload?.matches || []);
    const match = findMatchForUser(matches, targetUserId);

    if (match) {
      return match;
    }

    await sleep(1000);
  }

  throw new Error('Timed out waiting for reciprocal match to be generated');
}

test('critical browser integration flow from match acceptance to review', async ({ page, request }) => {
  const now = Date.now();
  const skillA = `E2E Offered Skill ${now}`;
  const skillB = `E2E Requested Skill ${now}`;
  const userA = {
    displayName: `E2E Alice ${now}`,
    email: `e2e.alice.${now}@example.com`,
    password: 'Password123!',
    offeredSkill: skillA,
    wantedSkill: skillB,
  };
  const userB = {
    displayName: `E2E Bob ${now}`,
    email: `e2e.bob.${now}@example.com`,
    password: 'Password123!',
    offeredSkill: skillB,
    wantedSkill: skillA,
  };

  const seededUserA = await registerAndSeedUser(request, userA);
  const seededUserB = await registerAndSeedUser(request, userB);

  await waitForMatch(request, seededUserA.token, seededUserB.id);

  await page.goto('/login');
  await page.evaluate((tokens) => {
    localStorage.setItem('skillswap.accessToken', tokens.accessToken);
    localStorage.setItem('skillswap.refreshToken', tokens.refreshToken);
  }, {
    accessToken: seededUserA.token,
    refreshToken: seededUserA.refreshToken,
  });
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });

  const navMatchesLink = page.getByRole('navigation').getByRole('link', { name: 'Matches', exact: true });
  const hasDashboardNav = await navMatchesLink.isVisible().catch(() => false);

  if (!hasDashboardNav) {
    await page.goto('/login');
    await page.getByPlaceholder('name@skillswap.ai').fill(seededUserA.email);
    await page.getByPlaceholder('Your password').fill(seededUserA.password);
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  }

  await expect(navMatchesLink).toBeVisible({ timeout: 20000 });
  await navMatchesLink.click();
  await expect(page).toHaveURL(/\/matches$/, { timeout: 10000 });

  await page.getByPlaceholder('Search matches...').fill(seededUserB.displayName);

  const targetMatchCard = page.locator('article').filter({ hasText: seededUserB.displayName }).first();
  await expect(targetMatchCard).toBeVisible({ timeout: 30000 });
  await targetMatchCard.getByRole('button', { name: 'Accept Match' }).click();

  await expect(page.getByRole('heading', { name: 'Create Swap Request' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Create Swap' }).click();

  await expect(page).toHaveURL(/\/swaps\/[0-9a-f-]+$/i, { timeout: 20000 });

  const swapId = page.url().split('/swaps/')[1]?.split(/[?#]/)[0];
  expect(swapId).toBeTruthy();

  await apiRequest(request, {
    method: 'POST',
    path: `/swaps/${swapId}/accept`,
    token: seededUserB.token,
  });

  await page.reload();

  const scheduleButton = page.getByRole('button', { name: 'Schedule Session' });
  await expect(scheduleButton).toBeVisible({ timeout: 20000 });
  await scheduleButton.click();

  const markCompletedButton = page.getByRole('button', { name: 'Mark Completed' });

  try {
    await expect(markCompletedButton).toBeVisible({ timeout: 10000 });
  } catch {
    const startNowButton = page.getByRole('button', { name: 'Start Now' });
    await expect(startNowButton).toBeVisible({ timeout: 10000 });
    await startNowButton.click();
  }

  await expect(markCompletedButton).toBeVisible({ timeout: 20000 });
  await markCompletedButton.click();

  await apiRequest(request, {
    method: 'POST',
    path: `/swaps/${swapId}/complete`,
    token: seededUserB.token,
  });

  // Re-confirm from initiator to avoid race conditions where both confirms land concurrently.
  await apiRequest(request, {
    method: 'POST',
    path: `/swaps/${swapId}/complete`,
    token: seededUserA.token,
  });

  await page.reload();

  const leaveReviewButton = page.getByRole('button', { name: 'Leave Review' });
  await expect(leaveReviewButton).toBeVisible({ timeout: 20000 });
  await leaveReviewButton.click();

  await expect(page.getByRole('heading', { name: 'Leave a Review' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Rate 5 stars' }).click();
  await page
    .getByPlaceholder('Write your review here (min 20 characters)...')
    .fill('Excellent skill exchange experience. The full flow worked end to end.');

  const reviewResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().includes(`/api/swaps/${swapId}/reviews`)
  ));

  await page.getByRole('button', { name: 'Submit Review' }).click();

  const reviewResponse = await reviewResponsePromise;
  expect(reviewResponse.ok()).toBeTruthy();

  const storedReviews = await apiRequest(request, {
    method: 'GET',
    path: `/swaps/${swapId}/reviews`,
    token: seededUserA.token,
  });

  const reviewList = Array.isArray(storedReviews)
    ? storedReviews
    : (storedReviews?.reviews || []);

  expect(reviewList.length).toBeGreaterThan(0);
});
