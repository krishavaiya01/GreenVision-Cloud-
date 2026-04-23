import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import mongoose from 'mongoose';
import AwsRawLog from '../models/AwsRawLog.js';
import AwsIssueLog from '../models/AwsIssueLog.js';
import carbonEmissionService from './carbon-emission-service.js';
import { getAgenda } from '../scheduler/agenda.js';

const WINDOW_MS = parseInt(process.env.AWS_LOGS_WINDOW_MS || '60000', 10); // 1 min default
const RAW_INTERVAL_SEC = parseInt(process.env.AWS_LOGS_RAW_INTERVAL_SEC || '5', 10); // 5s default
const SAFETY_OVERLAP_MS = parseInt(process.env.AWS_LOGS_SAFETY_OVERLAP_MS || '3000', 10); // 3s

function classifyLevel(message = '') {
  try {
    const parsed = JSON.parse(message);
    const lvl = String(parsed.level || parsed.severity || '').toLowerCase();
    if (['error','err','fatal','critical','crit'].includes(lvl)) return 'error';
    if (['warn','warning'].includes(lvl)) return 'warn';
  } catch {}
  const m = message.toLowerCase();
  if (m.includes('exception') || m.includes('stacktrace')) return 'error';
  if (m.includes('error') || m.includes('failed') || m.includes('failure')) return 'error';
  if (m.includes('warn')) return 'warn';
  return null;
}

function makeLogsClient({ region, credentials }) {
  return new CloudWatchLogsClient({ region, credentials });
}

// Single-tenant via env for now; replace with per-user providers later
async function getIngestionTargets() {
  const configured = (process.env.AWS_LOG_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean);
  const region = process.env.AWS_REGION || 'us-east-1';
  const creds = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined; // allow default provider chain

  if (configured.length) {
    return [{ userId: null, region, credentials: creds, logGroups: configured }];
  }

  // Auto-discover when not configured
  if (String(process.env.AWS_LOGS_AUTO_DISCOVER || 'true').toLowerCase() === 'true') {
    try {
      const client = makeLogsClient({ region, credentials: creds });
      const prefix = process.env.AWS_LOG_GROUP_PREFIX || undefined;
      const max = parseInt(process.env.AWS_LOGS_AUTO_DISCOVER_MAX || '3', 10);
      const cmd = new DescribeLogGroupsCommand({ logGroupNamePrefix: prefix, limit: 50 });
      const out = await client.send(cmd);
      const groups = (out.logGroups || []).map(g => g.logGroupName).filter(Boolean).slice(0, max);
      if (groups.length) {
        console.log(`aws-logs:auto-discover groups=${groups.join(', ')}`);
        return [{ userId: null, region, credentials: creds, logGroups: groups }];
      }
      console.warn('aws-logs:auto-discover found 0 log groups');
    } catch (e) {
      console.warn('aws-logs:auto-discover failed:', e.message);
    }
  }
  return [];
}

async function collectAwsRawLogs() {
  const targets = await getIngestionTargets();
  if (!targets.length) {
    console.warn('aws-logs:collect-raw skipped – no log groups configured or discovered');
    return;
  }
  const endTime = Date.now();
  const startTime = endTime - (RAW_INTERVAL_SEC * 1000) - SAFETY_OVERLAP_MS;

  for (const t of targets) {
    const client = makeLogsClient({ region: t.region, credentials: t.credentials });
    for (const logGroupName of t.logGroups) {
      let totalGroupEvents = 0;
      let nextToken = undefined;
      do {
        try {
          const cmd = new FilterLogEventsCommand({
            logGroupName,
            startTime,
            endTime,
            nextToken,
            limit: 10000,
          });
          const res = await client.send(cmd);
          const events = res.events || [];

          if (events.length) {
            const ops = events.map((e) => ({
              updateOne: {
                filter: { eventId: e.eventId },
                update: {
                  $setOnInsert: {
                    userId: t.userId,
                    eventId: e.eventId,
                    logGroup: logGroupName,
                    logStream: e.logStreamName || null,
                    timestamp: new Date(e.timestamp || Date.now()),
                    message: e.message || '',
                    // windowStart/expireAt set by schema hook
                  }
                },
                upsert: true,
              }
            }));
            await AwsRawLog.bulkWrite(ops, { ordered: false });
            totalGroupEvents += events.length;
          }

          nextToken = res.nextToken;
        } catch (err) {
          console.error(`CloudWatch Logs fetch failed for ${logGroupName}: ${err.message}`);
          nextToken = undefined;
        }
      } while (nextToken);
      console.log(`aws-logs:collect-raw group=${logGroupName} window=${new Date(startTime).toISOString()}..${new Date(endTime).toISOString()} events=${totalGroupEvents}`);
    }
  }
}

async function persistIssuesAndCleanup(windowStart) {
  const query = { windowStart, processed: false };
  const cursor = AwsRawLog.find(query).lean().cursor();

  let batch = [];
  const BATCH = 500;
  let upserts = 0;
  let rawCount = 0;
  let totalBytes = 0; // for emission estimation

  for await (const doc of cursor) {
    batch.push(doc);
    rawCount++;
    // bytes estimation (message bytes + nominal 200B metadata overhead)
    try {
      totalBytes += Buffer.byteLength(doc.message || '', 'utf8') + 200;
    } catch { /* ignore */ }
    if (batch.length >= BATCH) {
      upserts += await flushBatch(batch, windowStart);
      batch = [];
    }
  }
  if (batch.length) upserts += await flushBatch(batch, windowStart);

  // cleanup raw (buffer) for this window
  await AwsRawLog.deleteMany({ windowStart });
  console.log(`aws-logs:process-window window=${new Date(windowStart).toISOString()} rawCount=${rawCount} issuesUpserted=${upserts} bytes=${totalBytes}`);

  // Record emission event (provider=aws). userId currently null (single-tenant global logs)
  try {
    await carbonEmissionService.recordLogWindowEmission({
      userId: null,
      provider: 'aws',
      bytesIngested: totalBytes,
      windowStart,
      windowEnd: new Date(windowStart.getTime() + WINDOW_MS)
    });
    // Optionally simulate other providers for multi-cloud demo
    await carbonEmissionService.maybeSimulateAdditionalProviders();
  } catch (e) {
    console.warn('carbon:record-failed', e.message);
  }
}

async function flushBatch(batch, windowStart) {
  const ops = [];
  for (const l of batch) {
    const level = classifyLevel(l.message);
    if (!level) continue;
    ops.push({
      updateOne: {
        filter: { eventId: l.eventId },
        update: {
          $setOnInsert: {
            userId: l.userId || null,
            eventId: l.eventId,
            logGroup: l.logGroup,
            logStream: l.logStream,
            timestamp: l.timestamp,
            message: l.message,
            level,
            context: { windowStart },
          }
        },
        upsert: true,
      }
    });
  }
  if (ops.length) {
    const res = await AwsIssueLog.bulkWrite(ops, { ordered: false });
    return res.upsertedCount || 0;
  }
  return 0;
}

export async function registerAwsLogsJobs() {
  const agenda = getAgenda();
  if (!agenda) throw new Error('Agenda not initialized');

  // Collector every N seconds
  agenda.define('aws-logs:collect-raw', async () => {
    await collectAwsRawLogs();
  });

  // Process last complete window every minute (configurable by env)
  agenda.define('aws-logs:process-window', async () => {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const lastWindowStart = currentWindowStart - WINDOW_MS;
    await persistIssuesAndCleanup(new Date(lastWindowStart));
  });

  await agenda.every(`${RAW_INTERVAL_SEC} seconds`, 'aws-logs:collect-raw');
  // If WINDOW_MS is set to 60s, schedule every minute; otherwise compute a cron-like interval
  if (WINDOW_MS % 60000 === 0 && WINDOW_MS <= 60000) {
    await agenda.every('1 minute', 'aws-logs:process-window');
  } else {
    // Fallback to processing every minute; job computes last window via WINDOW_MS anyway
    await agenda.every('1 minute', 'aws-logs:process-window');
  }
}
