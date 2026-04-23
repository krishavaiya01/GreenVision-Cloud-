import { PubSub } from '@google-cloud/pubsub';
import GcpRawLog from '../models/GcpRawLog.js';
import GcpLog from '../models/GcpLog.js';
import GcpIssueLog from '../models/GcpIssueLog.js';
import carbonEmissionService from './carbon-emission-service.js';
import { getAgenda } from '../scheduler/agenda.js';

const WINDOW_MS = parseInt(process.env.GCP_LOGS_WINDOW_MS || '60000', 10);

function classifyLevel(payload = {}) {
  const sev = String(payload.severity || '').toLowerCase();
  if (['error','err','fatal','critical','crit','alert','emerg'].includes(sev)) return 'error';
  if (['warning','warn'].includes(sev)) return 'warn';
  return null;
}

async function handleMessage(message) {
  try {
    const data = JSON.parse(message.data.toString());
    // Cloud Logging sinks via Pub/Sub usually wrap the entry under jsonPayload or textPayload
    const entry = data?.protoPayload || data?.jsonPayload || data?.payload || data;
    const eventId = data?.insertId || data?.logEntry?.insertId || message.id;
    const logName = data?.logName || data?.logEntry?.logName || 'unknown';
    const resource = data?.resource?.type || data?.logEntry?.resource?.type || null;
    const tsStr = data?.timestamp || data?.receiveTimestamp || data?.logEntry?.timestamp;
    const ts = tsStr ? new Date(tsStr) : new Date();
    const text = data?.textPayload || entry?.message || JSON.stringify(entry);
    // Compute windowStart and TTL explicitly because updateOne+upsert won't trigger schema hooks
    const RAW_TTL_MIN = parseInt(process.env.GCP_LOGS_RAW_TTL_MIN || '15', 10);
    const ws = Math.floor(ts.getTime() / WINDOW_MS) * WINDOW_MS;
    const windowStart = new Date(ws);
    const expireAt = new Date(Date.now() + RAW_TTL_MIN * 60 * 1000);

    const doc = {
      userId: null,
      eventId,
      logName,
      resource,
      timestamp: ts,
      message: text,
      windowStart,
      expireAt,
    };
    if ((process.env.GCP_LOGS_DEBUG || '').toLowerCase() === 'true') {
      console.log(`gcp-logs:recv eventId=${eventId} logName=${logName} resource=${resource} ts=${ts.toISOString()}`);
    }
    // Persist permanent copy for visibility
  const severity = (data?.severity || '').toString();
  const payload = { logName, resource, severity: data?.severity, labels: data?.labels, resourceLabels: data?.resource?.labels };
    await GcpLog.updateOne(
      { eventId },
      { $setOnInsert: { ...doc, severity, payload } },
      { upsert: true }
    );
    // Raw buffer for window processing
    await GcpRawLog.updateOne(
      { eventId },
      { $setOnInsert: { ...doc, severity }, $set: { processed: false } },
      { upsert: true }
    );
    message.ack();
  } catch (e) {
    console.warn('gcp-logs:handleMessage failed', e.message);
    message.nack();
  }
}

export async function startGcpLogsSubscriber() {
  const topicName = (process.env.GCP_LOGS_TOPIC || '').trim() || undefined;
  const subPath = (process.env.GCP_LOGS_SUBSCRIPTION || '').trim();
  const subscriptionName = subPath.includes('/subscriptions/') ? subPath.split('/subscriptions/').pop() : subPath;
  if (!subscriptionName) {
    console.warn('gcp-logs:subscriber skipped – GCP_LOGS_SUBSCRIPTION not set');
    return null;
  }
  const pubsub = new PubSub({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  const sub = pubsub.subscription(subscriptionName);
  sub.on('message', handleMessage);
  sub.on('error', (err) => console.error('gcp-logs:subscriber error', err.code ? `${err.code} ${err.message}` : err.message));
  let projectId = null;
  try { projectId = await pubsub.getProjectId(); } catch {}
  console.log(`▶️ gcp-logs: subscriber listening on ${subscriptionName}${topicName ? ` (topic: ${topicName})` : ''}${projectId ? ` [project: ${projectId}]` : ''}`);
  return sub;
}

async function persistIssuesAndRecord(windowStart) {
  const query = { windowStart, processed: false };
  const cursor = GcpRawLog.find(query).lean().cursor();
  const batch = [];
  const BATCH = 500;
  let upserts = 0;
  let rawCount = 0;
  let totalBytes = 0;
  for await (const doc of cursor) {
    batch.push(doc);
    rawCount++;
    try { totalBytes += Buffer.byteLength(doc.message || '', 'utf8') + 200; } catch {}
    if (batch.length >= BATCH) { upserts += await flushBatch(batch, windowStart); batch.length = 0; }
  }
  if (batch.length) upserts += await flushBatch(batch, windowStart);
  await GcpRawLog.deleteMany({ windowStart });
  console.log(`gcp-logs:process-window ${new Date(windowStart).toISOString()} raw=${rawCount} issues=${upserts} bytes=${totalBytes}`);
  try {
    await carbonEmissionService.recordLogWindowEmission({
      userId: null,
      provider: 'gcp',
      bytesIngested: totalBytes,
      windowStart,
      windowEnd: new Date(windowStart.getTime() + WINDOW_MS)
    });
  } catch (e) {
    console.warn('gcp-carbon:record failed', e.message);
  }
}

async function flushBatch(list, windowStart) {
  const ops = [];
  for (const l of list) {
    // Prefer explicit severity if present; fallback to parsing message JSON
    const levelFromSeverity = classifyLevel({ severity: l.severity });
    const levelParsed = levelFromSeverity || classifyLevel(safeJson(l.message));
    const level = levelParsed;
    if (!level) continue;
    ops.push({
      updateOne: {
        filter: { eventId: l.eventId },
        update: { $setOnInsert: { userId: l.userId || null, eventId: l.eventId, logName: l.logName, resource: l.resource, timestamp: l.timestamp, message: l.message, level, context: { windowStart } } },
        upsert: true,
      }
    });
  }
  if (ops.length) {
    const res = await GcpIssueLog.bulkWrite(ops, { ordered: false });
    return res.upsertedCount || 0;
  }
  return 0;
}

function safeJson(str) {
  if (!str || typeof str !== 'string') return {};
  try { return JSON.parse(str); } catch { return {}; }
}

export async function registerGcpLogsJobs() {
  const agenda = getAgenda();
  if (!agenda) throw new Error('Agenda not initialized');
  // Process the last window every minute (same pattern as AWS/Azure)
  agenda.define('gcp-logs:process-window', async () => {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const lastWindowStart = currentWindowStart - WINDOW_MS;
    await persistIssuesAndRecord(new Date(lastWindowStart));
  });
  await agenda.every('1 minute', 'gcp-logs:process-window');
}
