import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient, Durations } from '@azure/monitor-query';
import AzureRawLog from '../models/AzureRawLog.js';
import AzureIssueLog from '../models/AzureIssueLog.js';
import AzureLog from '../models/AzureLog.js';
import carbonEmissionService from './carbon-emission-service.js';
import { getAgenda } from '../scheduler/agenda.js';

const WINDOW_MS = parseInt(process.env.AZURE_LOGS_WINDOW_MS || '60000', 10); // 1m
const RAW_INTERVAL_SEC = parseInt(process.env.AZURE_LOGS_RAW_INTERVAL_SEC || '10', 10); // 10s
const SAFETY_OVERLAP_MS = parseInt(process.env.AZURE_LOGS_SAFETY_OVERLAP_MS || '3000', 10);

function classifyLevelAzure(record = {}) {
  // AzureActivity: Level usually 'Informational', 'Warning', 'Error'
  const level = String(record.Level || record.level || '').toLowerCase();
  if (['error','err','critical','crit','severe','fatal'].includes(level)) return 'error';
  if (['warn','warning'].includes(level)) return 'warn';
  const status = String(record.ActivityStatus || record.ResultType || '').toLowerCase();
  if (['failed','failure','error'].includes(status)) return 'error';
  return null;
}

function getCredential() {
  return new DefaultAzureCredential({ additionallyAllowedTenants: ['*'] });
}

async function getActiveLogTables({ minutes = 1440 } = {}) {
  const workspaceId = process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) return { tables: [], usage: [] };
  const logsClient = new LogsQueryClient(getCredential());
  const kql = `
    Usage
    | where TimeGenerated > ago(${minutes}m)
    | summarize rows = sum(Quantity) by DataType
    | top 50 by rows desc
  `;
  const result = await logsClient.queryWorkspace(workspaceId, kql, { timespan: 'P7D' });
  const t = result.tables?.[0];
  const rows = (t?.rows || []).map(r => ({ DataType: r[0], rows: r[1] }));
  // Prefer AppService*, AzureDiagnostics, AzureActivity and other common tables
  const preferred = rows
    .map(r => r.DataType)
    .filter(name => /^(AppService|AzureDiagnostics|AzureActivity|AppTraces|AppRequests|AppDependencies|AppExceptions|ContainerLog)/i.test(name));
  return { tables: preferred.length ? preferred : rows.map(r => r.DataType), usage: rows };
}

function parseLookbackToMinutes(lb) {
  if (!lb) return 60;
  const s = String(lb).trim();
  const m = s.match(/^(\d+)(m|h|d)$/i);
  if (!m) return Number(s) || 60;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'm') return n;
  if (unit === 'h') return n * 60;
  if (unit === 'd') return n * 1440;
  return 60;
}

async function fetchAzureActivityRaw({ limit = 1000, lookback } = {}) {
  const workspaceId = process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) return [];
  const logsClient = new LogsQueryClient(getCredential());

  const tablesCsv = process.env.AZURE_LOGS_TABLES || 'AzureActivity,AzureDiagnostics,AppServiceHTTPLogs,AppServiceConsoleLogs,AppServiceAppLogs';
  const baseTables = tablesCsv.split(',').map(s => s.trim()).filter(Boolean);
  const timeAgo = lookback || process.env.AZURE_LOGS_LOOKBACK || '24h';
  const minutes = parseLookbackToMinutes(timeAgo);
  const timeSpanOpt = { timespan: (minutes <= 1440 ? 'PT24H' : 'P7D') };

  async function runKqlWithTables(tbls) {
    if (!tbls.length) return [];
    const unionExpr = `union isfuzzy=true ${tbls.join(', ')}`;
    const kql = `
      ${unionExpr}
      | where TimeGenerated > ago(${timeAgo})
      | project TimeGenerated, CorrelationId, OperationName, Category, Level, ActivityStatus, ResultType, ResultDescription, Message, Details, RawData, SiteName, HttpMethod, Uri, ResourceGroup, ResourceId, ResourceProvider, Caller, _ResourceId
      | sort by TimeGenerated desc
      | take ${Math.max(1, Math.min(limit, 5000))}
    `;
  const result = await logsClient.queryWorkspace(workspaceId, kql, timeSpanOpt);
    const t = result.tables?.[0];
    if (!t) return [];
    return (t.rows || []).map((r) => { const o = {}; t.columns.forEach((c, i) => (o[c.name] = r[i])); return o; });
  }

  // 1) Try configured tables
  let rows = await runKqlWithTables(baseTables);
  // 2) Try active tables discovered from Usage
  if (!rows.length) {
    try {
      const { tables } = await getActiveLogTables({ minutes: 1440 });
      rows = await runKqlWithTables(tables);
    } catch (_) { /* ignore */ }
  }
  // 3) Very wide fallback: union all tables (capped by take)
  // Note: avoid union * to reduce invalid-properties errors; rely on configured + discovered tables only
  return rows;
}

async function collectAzureRawLogs() {
  const endTime = Date.now();
  const startTime = endTime - RAW_INTERVAL_SEC * 1000 - SAFETY_OVERLAP_MS;
  const rows = await fetchAzureActivityRaw({ limit: 2000, lookback: process.env.AZURE_LOGS_LOOKBACK || '24h' });
  if (!rows.length) return;

  let totalBytes = 0;
  const ops = rows.map((row) => {
    const msg = row.ResultDescription || row.Message || row.OperationName || JSON.stringify(row);
    let eventId = row.CorrelationId || `${row.TimeGenerated}-${row.OperationName}-${row.ResourceId || row._ResourceId || ''}`;
    if (!eventId) eventId = `${row.TimeGenerated}-${Math.random().toString(36).slice(2)}`;

    try { totalBytes += Buffer.byteLength(String(msg), 'utf8') + 300; } catch {}
    return {
      updateOne: {
        filter: { eventId },
        update: {
          $setOnInsert: {
            userId: null,
            eventId,
            logGroup: row.Category || 'AzureActivity',
            logStream: row.OperationName || row.CorrelationId || null,
            timestamp: row.TimeGenerated ? new Date(row.TimeGenerated) : new Date(),
            message: String(msg),
          },
        },
        upsert: true,
      },
    };
  });
  await AzureRawLog.bulkWrite(ops, { ordered: false });

  // Persist normalized logs to AzureLog for long-term analytics
  try {
    const normalized = rows.map((row) => ({
      time: row.TimeGenerated ? new Date(row.TimeGenerated) : new Date(),
      level: String(row.Level || row.ActivityStatus || '').toLowerCase(),
      category: row.Category || '',
      operation: row.OperationName || '',
      message: row.ResultDescription || row.Message || row.Details || row.RawData || row.OperationName || '',
      resourceId: row._ResourceId || row.ResourceId || '',
      provider: 'azure',
    }));
    if (normalized.length) {
      await AzureLog.insertMany(normalized, { ordered: false });
    }
  } catch (e) {
    // Ignore duplicate key errors
    if (!/duplicate key/i.test(e.message)) {
      console.warn('azure:AzureLog insert failed', e.message);
    }
  }

  // Record emission for this collection interval (tracked by window)
  const windowStart = new Date(Math.floor(startTime / WINDOW_MS) * WINDOW_MS);
  const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);
  try {
    await carbonEmissionService.recordLogWindowEmission({
      userId: null,
      provider: 'azure',
      bytesIngested: totalBytes,
      windowStart,
      windowEnd,
    });
  } catch (e) {
    console.warn('azure:emission-record-failed', e.message);
  }
}

async function flushAzureIssues(windowStart) {
  const cursor = AzureRawLog.find({ windowStart, processed: false }).lean().cursor();
  const BATCH = 500;
  let batch = [];
  let upserts = 0;
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH) { upserts += await persistIssues(batch, windowStart); batch = []; }
  }
  if (batch.length) upserts += await persistIssues(batch, windowStart);
  await AzureRawLog.deleteMany({ windowStart });
  return upserts;
}

async function persistIssues(batch, windowStart) {
  const ops = [];
  for (const l of batch) {
    const level = classifyLevelAzure(tryParseJson(l.message));
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
          },
        },
        upsert: true,
      },
    });
  }
  if (ops.length) {
    const res = await AzureIssueLog.bulkWrite(ops, { ordered: false });
    return res.upsertedCount || 0;
  }
  return 0;
}

function tryParseJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

export async function registerAzureLogsJobs() {
  if (!process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID) {
    console.warn('azure-logs: disabled – AZURE_LOG_ANALYTICS_WORKSPACE_ID not set');
    return;
  }
  const agenda = getAgenda();
  if (!agenda) throw new Error('Agenda not initialized');

  agenda.define('azure-logs:collect-raw', async () => {
    await collectAzureRawLogs();
  });

  agenda.define('azure-logs:process-window', async () => {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const lastWindowStart = currentWindowStart - WINDOW_MS;
    const up = await flushAzureIssues(new Date(lastWindowStart));
    console.log(`azure-logs:process-window upserts=${up}`);
  });

  await agenda.every(`${RAW_INTERVAL_SEC} seconds`, 'azure-logs:collect-raw');
  await agenda.every('1 minute', 'azure-logs:process-window');
  console.log('🗓️ Azure logs jobs registered');
}

export async function diagAzureLogsWindow(req, res) {
  try {
    const [rows, active] = await Promise.all([
      fetchAzureActivityRaw({ limit: 50 }),
      getActiveLogTables({ minutes: 1440 })
    ]);
    res.json({ success: true, data: { rows: rows.length, sample: rows.slice(0, 5), activeTables: active.tables, usageTop: active.usage } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Azure diag failed', error: e.message });
  }
}

// Summaries based on stored AzureLog + CarbonEmissionEvent
export async function getAzureLogsSummary({ sinceMinutes = 60 } = {}) {
  const minutes = Math.max(1, parseInt(sinceMinutes, 10) || 60);
  const to = new Date();
  const from = new Date(to.getTime() - minutes * 60 * 1000);

  const [counts, recent] = await Promise.all([
    AzureLog.aggregate([
      { $match: { time: { $gte: from, $lte: to } } },
      { $group: {
          _id: '$level',
          count: { $sum: 1 }
      } },
    ]),
    AzureLog.find({ time: { $gte: from, $lte: to } })
      .sort({ time: -1 })
      .limit(200)
      .lean(),
  ]);

  const map = { total: 0, error: 0, warn: 0, info: 0 };
  for (const c of counts) {
    map.total += c.count;
    if (c._id === 'error') map.error = c.count;
    else if (c._id === 'warn' || c._id === 'warning') map.warn = c.count;
    else map.info += c.count;
  }

  // If no stored recent logs, fallback to live KQL fetch
  let recentOut = recent;
  if (!recentOut || recentOut.length === 0) {
    try {
  const rows = await fetchAzureActivityRaw({ limit: 50, lookback: '24h' });
      recentOut = rows.map((row) => ({
        time: row.TimeGenerated ? new Date(row.TimeGenerated) : new Date(),
        level: String(row.Level || row.ActivityStatus || '').toLowerCase(),
        category: row.Category || '',
        operation: row.OperationName || '',
        message: row.ResultDescription || row.Message || row.OperationName || '',
        resourceId: row._ResourceId || row.ResourceId || '',
        provider: 'azure',
      }));
      // recompute counts from fallback sample
      map.total = recentOut.length;
      map.error = recentOut.filter(r => r.level === 'error').length;
      map.warn = recentOut.filter(r => r.level === 'warn' || r.level === 'warning').length;
      map.info = map.total - map.error - map.warn;
    } catch (e) {
      // ignore
    }
  }

  // Carbon/cost totals are tracked per window in CarbonEmissionEvent by recordLogWindowEmission
  // We re-aggregate for provider=azure over the same range
  try {
    const carbonSummary = await (await import('../models/CarbonEmissionEvent.js')).default.aggregate([
      { $match: { provider: 'azure', windowEnd: { $gte: from, $lte: to } } },
      { $group: {
          _id: null,
          bytes: { $sum: '$bytesIngested' },
          kWh: { $sum: '$estimatedKWh' },
          kgCO2: { $sum: '$estimatedCO2Kg' },
          cost: { $sum: '$estimatedCost' },
      } },
    ]);
    const c = carbonSummary?.[0] || { bytes: 0, kWh: 0, kgCO2: 0, cost: 0 };
    return { counts: map, recent: recentOut, carbon: { bytes: c.bytes, kWh: c.kWh, kgCO2: c.kgCO2, cost: c.cost }, range: { from, to } };
  } catch (e) {
    console.warn('azure:carbon summary failed', e.message);
    return { counts: map, recent: recentOut, carbon: { bytes: 0, kWh: 0, kgCO2: 0, cost: 0 }, range: { from, to } };
  }
}

