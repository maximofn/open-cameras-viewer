const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = process.env.PORT || 9191;
const PREFS_FILE = process.env.PREFS_FILE || path.resolve(__dirname, '../data/preferences.json');
const DEFAULT_PREFS = {
  layout: 4,
  assignments: [],
  enabledCameras: {}
};

async function ensurePrefsFile() {
  try {
    await fs.access(PREFS_FILE);
  } catch {
    await fs.mkdir(path.dirname(PREFS_FILE), { recursive: true });
    await fs.writeFile(PREFS_FILE, JSON.stringify(DEFAULT_PREFS, null, 2), 'utf8');
  }
}

async function readPrefs() {
  await ensurePrefsFile();
  const contents = await fs.readFile(PREFS_FILE, 'utf8');
  const parsed = JSON.parse(contents);
  return {
    layout: Number.isInteger(parsed.layout) ? parsed.layout : DEFAULT_PREFS.layout,
    assignments: Array.isArray(parsed.assignments) ? parsed.assignments : DEFAULT_PREFS.assignments,
    enabledCameras: typeof parsed.enabledCameras === 'object' && parsed.enabledCameras !== null
      ? sanitizeEnabledCameras(parsed.enabledCameras)
      : {}
  };
}

function sanitizeEnabledCameras(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = Boolean(value);
  }
  return result;
}

function normalizePayload(payload) {
  const normalized = { ...DEFAULT_PREFS };
  if (Number.isInteger(payload.layout) && payload.layout > 0) {
    normalized.layout = payload.layout;
  }
  if (Array.isArray(payload.assignments)) {
    normalized.assignments = payload.assignments.map(String);
  }
  if (payload.enabledCameras && typeof payload.enabledCameras === 'object') {
    normalized.enabledCameras = sanitizeEnabledCameras(payload.enabledCameras);
  }
  return normalized;
}

async function writePrefs(data) {
  const normalized = normalizePayload(data);
  await fs.writeFile(PREFS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.url !== '/preferences') {
    return sendJSON(res, 404, { error: 'Not Found' });
  }

  try {
    if (req.method === 'GET') {
      const prefs = await readPrefs();
      return sendJSON(res, 200, prefs);
    }

    if (req.method === 'POST') {
      req.setEncoding('utf8');
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.connection.destroy();
      });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const saved = await writePrefs(data);
          sendJSON(res, 200, saved);
        } catch (err) {
          sendJSON(res, 400, { error: 'Invalid JSON payload' });
        }
      });
      return;
    }

    return sendJSON(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Preferences server error:', error);
    return sendJSON(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Preferences server listening on port ${PORT}`);
});
