const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fieldnoteApiHandler = require('../lib/fieldnote-api-proxy');

function createResponse() {
  const headers = {};
  return {
    statusCode: 200,
    headersSent: false,
    body: '',
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; },
    end(value = '') {
      this.body = value;
      this.headersSent = true;
    },
    headers
  };
}

function createRequest(path, method = 'GET', body = {}, headers = {}) {
  return {
    url: path,
    method,
    body,
    headers: Object.assign({ host: 'fieldnote-preview.vercel.app', 'x-forwarded-proto': 'https' }, headers)
  };
}

function withSupabaseConfig(t) {
  const original = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    FIELDNOTE_APP_URL: process.env.FIELDNOTE_APP_URL,
    fetch: global.fetch
  };
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.VERCEL_URL = 'fieldnote-preview.vercel.app';
  process.env.VERCEL_ENV = 'preview';
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.FIELDNOTE_APP_URL;
  t.after(() => {
    Object.entries(original).forEach(([key, value]) => {
      if (key === 'fetch') global.fetch = value;
      else if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });
}

test('GitHub OAuth start uses PKCE and a secure short-lived verifier cookie', async (t) => {
  withSupabaseConfig(t);
  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/start'), response);

  assert.equal(response.statusCode, 303);
  const authorizeUrl = new URL(response.headers.Location);
  assert.equal(authorizeUrl.origin, 'https://project.supabase.co');
  assert.equal(authorizeUrl.pathname, '/auth/v1/authorize');
  assert.equal(authorizeUrl.searchParams.get('provider'), 'github');
  assert.equal(authorizeUrl.searchParams.get('redirect_to'), 'https://fieldnote-preview.vercel.app/api/auth/github/callback');
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 's256');

  const oauthCookie = response.headers['Set-Cookie'];
  assert.match(oauthCookie, /fieldnote_github_oauth=([^;]+)/);
  assert.match(oauthCookie, /HttpOnly/);
  assert.match(oauthCookie, /Secure/);
  const verifier = oauthCookie.match(/fieldnote_github_oauth=([^;]+)/)[1];
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(authorizeUrl.searchParams.get('code_challenge'), challenge);
});

test('GitHub OAuth production callback uses the stable Vercel production domain', async (t) => {
  withSupabaseConfig(t);
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'fieldnote-eta-six.vercel.app';
  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/start'), response);

  assert.equal(new URL(response.headers.Location).searchParams.get('redirect_to'),
    'https://fieldnote-eta-six.vercel.app/api/auth/github/callback');
});

test('email registration confirmation returns learners to the active deployment', async (t) => {
  withSupabaseConfig(t);
  let signupUrl;
  global.fetch = async (url) => {
    signupUrl = new URL(String(url));
    return new Response(JSON.stringify({
      user: { id: 'pending-user', email: 'learner@example.test' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/register', 'POST', {
    name: 'Fieldnote Learner',
    email: 'learner@example.test',
    password: 'a-secure-password-long-enough',
    role: 'student',
    profile: {
      program: 'Web Development',
      educationBackground: 'Other',
      confirmEducationBackground: true
    }
  }), response);

  assert.equal(signupUrl.origin, 'https://project.supabase.co');
  assert.equal(signupUrl.pathname, '/auth/v1/signup');
  assert.equal(signupUrl.searchParams.get('redirect_to'),
    'https://fieldnote-preview.vercel.app/?auth=signup-confirmed');
  assert.equal(response.statusCode, 202);
  assert.equal(JSON.parse(response.body).confirmationRequired, true);
});

test('password recovery code requests return to the active deployment, not localhost', async (t) => {
  withSupabaseConfig(t);
  process.env.FIELDNOTE_APP_URL = 'http://localhost:3000';
  let recoveryUrl;
  global.fetch = async (url) => {
    recoveryUrl = new URL(String(url));
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/password-reset-request', 'POST', {
    email: 'learner@example.test'
  }), response);

  assert.equal(recoveryUrl.origin, 'https://project.supabase.co');
  assert.equal(recoveryUrl.pathname, '/auth/v1/recover');
  assert.equal(recoveryUrl.searchParams.get('redirect_to'),
    'https://fieldnote-preview.vercel.app/?auth=password-recovery');
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).message,
    'Check your email for a password-reset code, then enter it here to reset your password.');
});

test('production password recovery code requests use the stable Vercel domain', async (t) => {
  withSupabaseConfig(t);
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'fieldnote-eta-six.vercel.app';
  process.env.FIELDNOTE_APP_URL = 'http://localhost:3000';
  let recoveryUrl;
  global.fetch = async (url) => {
    recoveryUrl = new URL(String(url));
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/password-reset-request', 'POST', {
    email: 'learner@example.test'
  }), response);

  assert.equal(recoveryUrl.searchParams.get('redirect_to'),
    'https://fieldnote-eta-six.vercel.app/?auth=password-recovery');
  assert.equal(response.statusCode, 200);
});

test('GitHub OAuth callback exchanges the code and stores the session in HttpOnly cookies', async (t) => {
  withSupabaseConfig(t);
  const verifier = 'test-pkce-verifier';
  const accessToken = 'test-access-token-' + 'x'.repeat(7000);
  let exchangeBody;
  const requestedUrls = [];
  global.fetch = async (url, options) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);
    if (requestUrl === 'https://project.supabase.co/auth/v1/token?grant_type=pkce') {
      exchangeBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        access_token: accessToken,
        refresh_token: 'test-refresh-token',
        expires_in: 3600
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (requestUrl === 'https://project.supabase.co/auth/v1/user') {
      assert.equal(options.headers.get('Authorization'), 'Bearer ' + accessToken);
      return new Response(JSON.stringify({
        id: 'github-learner-id',
        email: 'learner@example.test',
        user_metadata: { name: 'GitHub Learner' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (requestUrl.startsWith('https://project.supabase.co/rest/v1/profiles?')) {
      return new Response(JSON.stringify([{
        id: 'github-learner-id',
        full_name: 'GitHub Learner',
        role: 'student',
        profile: {}
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected request in GitHub OAuth callback test.');
  };
  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/callback?code=one-time-code', 'GET', {}, {
    cookie: 'fieldnote_github_oauth=' + verifier
  }), response);

  assert.deepEqual(exchangeBody, { auth_code: 'one-time-code', code_verifier: verifier });
  assert.ok(requestedUrls.includes('https://project.supabase.co/auth/v1/user'));
  assert.ok(requestedUrls.some((requestedUrl) => requestedUrl.startsWith('https://project.supabase.co/rest/v1/profiles?')));
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location, 'https://fieldnote-preview.vercel.app/?auth=github-success');
  assert.ok(Array.isArray(response.headers['Set-Cookie']));
  const sessionCookies = response.headers['Set-Cookie'].filter((cookie) =>
    /^fieldnote_supabase_session\.\d+=/.test(cookie) && /Max-Age=604800/.test(cookie)
  );
  assert.ok(sessionCookies.length > 1);
  sessionCookies.forEach((cookie) => {
    assert.ok(cookie.length < 3100);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
  });
  assert.match(response.headers['Set-Cookie'].at(-1), /fieldnote_github_oauth=.*Max-Age=0/);

  const browserCookieHeader = sessionCookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
  const meResponse = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/me', 'GET', {}, { cookie: browserCookieHeader }), meResponse);
  assert.equal(meResponse.statusCode, 200);
  assert.equal(JSON.parse(meResponse.body).user.id, 'github-learner-id');
});

test('authenticated GitHub user receives a least-privilege student profile if the profile trigger did not create one', async (t) => {
  withSupabaseConfig(t);
  const sessionCookie = Buffer.from(JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  let profileLookups = 0;
  let insertedProfile;
  let insertPreference;
  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl === 'https://project.supabase.co/auth/v1/user') {
      return new Response(JSON.stringify({
        id: 'github-learner-id',
        email: 'learner@example.test',
        created_at: '2026-01-01T00:00:00.000Z',
        user_metadata: { name: 'GitHub Learner', fieldnote_role: 'admin' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (requestUrl.startsWith('https://project.supabase.co/rest/v1/profiles?')) {
      profileLookups++;
      const rows = profileLookups === 1 ? [] : [{
        id: 'github-learner-id',
        full_name: 'GitHub Learner',
        role: 'student',
        profile: {},
        created_at: '2026-01-01T00:00:00.000Z'
      }];
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    assert.equal(requestUrl, 'https://project.supabase.co/rest/v1/profiles');
    insertedProfile = JSON.parse(options.body);
    insertPreference = options.headers.get('Prefer');
    return new Response('[]', { status: 201, headers: { 'Content-Type': 'application/json' } });
  };

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/me', 'GET', {}, {
    cookie: 'fieldnote_supabase_session=' + sessionCookie
  }), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(insertedProfile, {
    id: 'github-learner-id',
    full_name: 'GitHub Learner',
    role: 'student',
    profile: {}
  });
  assert.equal(insertPreference, 'resolution=ignore-duplicates,return=representation');
  assert.equal(JSON.parse(response.body).user.role, 'student');
  assert.equal(JSON.parse(response.body).user.name, 'GitHub Learner');
});

test('authentication endpoint distinguishes a missing browser session cookie', async (t) => {
  withSupabaseConfig(t);
  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/me'), response);

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).code, 'session_cookie_missing');
});

test('authentication endpoint clears an invalid saved browser session', async (t) => {
  withSupabaseConfig(t);
  const sessionCookie = Buffer.from(JSON.stringify({
    access_token: 'rejected-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  global.fetch = async () => new Response(JSON.stringify({ message: 'invalid JWT' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/me', 'GET', {}, {
    cookie: 'fieldnote_supabase_session=' + sessionCookie
  }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).code, 'session_cookie_invalid');
  assert.ok(response.headers['Set-Cookie'].some((cookie) =>
    /fieldnote_supabase_session\.0=.*Max-Age=0/.test(cookie)
  ));
});

test('GitHub OAuth callback does not report success when learner profile setup fails', async (t) => {
  withSupabaseConfig(t);
  global.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith('/auth/v1/token?grant_type=pkce')) {
      return new Response(JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (requestUrl.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({
        id: 'github-learner-id',
        email: 'learner@example.test',
        user_metadata: { name: 'GitHub Learner' }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'database unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/callback?code=one-time-code', 'GET', {}, {
    cookie: 'fieldnote_github_oauth=test-verifier'
  }), response);

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location,
    'https://fieldnote-preview.vercel.app/?auth=github-error&reason=account-setup');
  assert.ok(![].concat(response.headers['Set-Cookie']).some((cookie) =>
    cookie.startsWith('fieldnote_supabase_session=')
  ));
});

test('GitHub OAuth callback reports provider rejection without forwarding its description', async (t) => {
  withSupabaseConfig(t);
  const response = createResponse();
  await fieldnoteApiHandler(createRequest(
    '/api/auth/github/callback?error=server_error&error_description=private-provider-detail',
    'GET',
    {},
    { cookie: 'fieldnote_github_oauth=test-verifier' }
  ), response);

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location,
    'https://fieldnote-preview.vercel.app/?auth=github-error&reason=provider-rejected');
  assert.doesNotMatch(response.headers.Location, /private-provider-detail/);
});

test('GitHub OAuth callback reports missing PKCE verifier', async (t) => {
  withSupabaseConfig(t);
  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/callback?code=one-time-code'), response);

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location,
    'https://fieldnote-preview.vercel.app/?auth=github-error&reason=missing-verifier');
});

test('GitHub OAuth callback reports rejected session exchange without exposing provider details', async (t) => {
  withSupabaseConfig(t);
  global.fetch = async () => new Response(JSON.stringify({
    error: 'invalid_grant',
    error_description: 'private-pkce-detail'
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const response = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/github/callback?code=one-time-code', 'GET', {}, {
    cookie: 'fieldnote_github_oauth=test-verifier'
  }), response);

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.Location,
    'https://fieldnote-preview.vercel.app/?auth=github-error&reason=session-exchange');
  assert.doesNotMatch(response.headers.Location, /private-pkce-detail/);
});

test('password recovery requires code verification before a password can be changed', async (t) => {
  withSupabaseConfig(t);
  let verificationBody;
  global.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/verify')) {
      verificationBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ access_token: 'recovery-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    assert.equal(String(url), 'https://project.supabase.co/auth/v1/user');
    assert.equal(options.headers.get('Authorization'), 'Bearer recovery-access-token');
    assert.deepEqual(JSON.parse(options.body), { password: 'a-new-password-long-enough' });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const verifyResponse = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/password-reset-verify', 'POST', {
    email: 'learner@example.test',
    code: '123456'
  }), verifyResponse);
  assert.deepEqual(verificationBody, { email: 'learner@example.test', token: '123456', type: 'recovery' });
  assert.equal(verifyResponse.statusCode, 200);
  const resetCookieHeader = [].concat(verifyResponse.headers['Set-Cookie']).find((cookie) =>
    cookie.startsWith('fieldnote_password_reset=') && !/Max-Age=0/.test(cookie)
  );
  assert.match(resetCookieHeader, /HttpOnly/);
  assert.match(resetCookieHeader, /Path=\/api\/auth(?:;|$)/);

  const resetToken = resetCookieHeader.match(/fieldnote_password_reset=([^;]+)/)[1];
  const updateResponse = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/password-reset-confirm', 'POST', {
    password: 'a-new-password-long-enough'
  }, { cookie: 'fieldnote_password_reset=' + resetToken }), updateResponse);
  assert.equal(updateResponse.statusCode, 200);
  assert.match(updateResponse.headers['Set-Cookie'], /fieldnote_password_reset=.*Max-Age=0/);
  assert.match(updateResponse.body, /Password updated/);

  const unverifiedResponse = createResponse();
  await fieldnoteApiHandler(createRequest('/api/auth/password-reset-confirm', 'POST', {
    password: 'a-new-password-long-enough'
  }), unverifiedResponse);
  assert.equal(unverifiedResponse.statusCode, 401);
});
