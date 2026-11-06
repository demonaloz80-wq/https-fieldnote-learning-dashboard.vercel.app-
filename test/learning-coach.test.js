const test = require('node:test');
const assert = require('node:assert/strict');
const fieldnoteApiHandler = require('../lib/fieldnote-api-proxy');
const { fetchCopilot } = fieldnoteApiHandler;

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    end(body) {
      this.body = body;
    }
  };
}

function saveEnvironment(names) {
  const original = {};
  names.forEach((name) => {
    original[name] = process.env[name];
  });
  return () => {
    Object.keys(original).forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  };
}

async function callCoach(rateLimitResponse) {
  const originalFetch = global.fetch;
  const restoreEnvironment = saveEnvironment([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'COPILOT_GITHUB_TOKEN',
    'COPILOT_MODEL'
  ]);
  const requests = [];
  process.env.SUPABASE_URL = 'https://fieldnote-test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.COPILOT_GITHUB_TOKEN;
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return rateLimitResponse || new Response('true', { status: 200 });
  };

  const response = createResponse();
  try {
    await fieldnoteApiHandler({
      method: 'POST',
      url: '/api/coach',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { question: 'Explain this lesson.' }
    }, response);
    return { response, requests };
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment();
  }
}

test('Learning Coach sends its lesson context through the authenticated Copilot SDK', async () => {
  const restoreEnvironment = saveEnvironment([
    'COPILOT_GITHUB_TOKEN',
    'COPILOT_MODEL'
  ]);
  const calls = {};
  process.env.COPILOT_GITHUB_TOKEN = 'test-copilot-secret';
  process.env.COPILOT_MODEL = 'auto';

  class MockCopilotClient {
    constructor(options) {
      calls.clientOptions = options;
    }

    async start() {
      calls.started = true;
    }

    async createSession(options) {
      calls.sessionOptions = options;
      return {
        async sendAndWait(options) {
          calls.prompt = options.prompt;
          return { data: { content: 'Here is an explanation.' } };
        },
        async disconnect() {
          calls.disconnected = true;
        }
      };
    }

    async stop() {
      calls.stopped = true;
    }
  }

  const sdk = { CopilotClient: MockCopilotClient };

  try {
    const answer = await fetchCopilot('How does this work?', 'Semantic HTML', 'Use landmarks for page structure.', sdk);
    assert.equal(answer, 'Here is an explanation.');
    assert.equal(calls.clientOptions.gitHubToken, 'test-copilot-secret');
    assert.equal(calls.clientOptions.useLoggedInUser, false);
    assert.equal(calls.sessionOptions.model, 'auto');
    assert.equal(calls.clientOptions.mode, 'empty');
    assert.match(calls.prompt, /Current learning page: Semantic HTML/);
    assert.match(calls.prompt, /Use landmarks for page structure/);
    assert.match(calls.prompt, /How does this work\?/);
    assert.equal(calls.disconnected, true);
    assert.equal(calls.stopped, true);
  } finally {
    restoreEnvironment();
  }
});

test('Learning Coach reports missing Copilot credentials', async () => {
  const result = await callCoach();

  assert.equal(result.response.statusCode, 503);
  assert.match(JSON.parse(result.response.body).error, /COPILOT_GITHUB_TOKEN/);
});

test('Learning Coach reports Supabase rate-limit failures instead of a generic 500', async () => {
  const result = await callCoach(new Response(JSON.stringify({ message: 'database unavailable' }), { status: 500 }));

  assert.equal(result.response.statusCode, 503);
  assert.match(JSON.parse(result.response.body).error, /Supabase rate limit/);
});

test('health endpoint reports Copilot configuration without exposing credentials', async () => {
  const restoreEnvironment = saveEnvironment([
    'COPILOT_GITHUB_TOKEN',
    'COPILOT_MODEL'
  ]);
  process.env.COPILOT_GITHUB_TOKEN = 'test-secret-do-not-return';
  process.env.COPILOT_MODEL = 'auto';
  const response = createResponse();
  try {
    await fieldnoteApiHandler({ method: 'GET', url: '/api/health', headers: {} }, response);
    assert.deepEqual(JSON.parse(response.body), {
      status: 'ok',
      provider: 'supabase',
      coach: { configured: true, provider: 'github-copilot', model: 'auto' }
    });
    assert.doesNotMatch(response.body, /test-secret-do-not-return/);
  } finally {
    restoreEnvironment();
  }
});
