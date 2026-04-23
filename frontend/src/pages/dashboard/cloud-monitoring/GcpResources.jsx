import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Link,
  Divider,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { cloudGcpApi } from "../../../services/api/cloudGcpApi";
import apiClient from "../../../services/api/apiClient";
import { cloudMetricApi } from "../../../services/api/cloudMetricApi";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend);

export default function GcpResources() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [instances, setInstances] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subs, setSubs] = useState([]);
  const [costSeries, setCostSeries] = useState(null);
  const [costLoading, setCostLoading] = useState(true);
  const [counts, setCounts] = useState({ instances: 0, clusters: 0, buckets: 0, topics: 0, subscriptions: 0 });
  const [projectId, setProjectId] = useState("");
  const [errors, setErrors] = useState({});
  const [logs, setLogs] = useState([]); // issues
  const [allLogs, setAllLogs] = useState([]);
  const [logMode, setLogMode] = useState("issues"); // 'issues' | 'all'
  const [severity, setSeverity] = useState("");
  const [logName, setLogName] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [diag, setDiag] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await cloudGcpApi.getResources();
  const data = resp?.data?.data || {};
  setProjectId(data.projectId || "");
  setErrors(data.errors || {});
      setInstances(Array.isArray(data.instances) ? data.instances : []);
      setClusters(Array.isArray(data.clusters) ? data.clusters : []);
      setBuckets(Array.isArray(data.buckets) ? data.buckets : []);
      setTopics(Array.isArray(data.pubsub?.topics) ? data.pubsub.topics : []);
      setSubs(Array.isArray(data.pubsub?.subscriptions) ? data.pubsub.subscriptions : []);
      if (data.counts) setCounts(data.counts);
      // Load diagnostics and logs in parallel
      try {
        const [diagRes, issuesRes, allRes] = await Promise.all([
          cloudGcpApi.getDiag().catch(() => null),
          cloudGcpApi.getIssueLogs({ sinceMinutes: 120, limit: 200 }).catch(() => null),
          cloudGcpApi.getLogs({ sinceMinutes: 120, limit: 200 }).catch(() => null),
        ]);
        const diagData = diagRes?.data?.data || null;
        if (diagData) setDiag(diagData);
        const issuesArr = Array.isArray(issuesRes?.data?.data) ? issuesRes.data.data : [];
        setLogs(issuesArr);
        const allArr = Array.isArray(allRes?.data?.data) ? allRes.data.data : [];
        setAllLogs(allArr);
      } catch (_) {/* best-effort */}
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load GCP resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCostLoading(true);
        const res = await cloudMetricApi.getCostSeries({ sinceHours: 12 });
        if (mounted) setCostSeries(res?.data || res);
      } catch (_) {
        if (mounted) setCostSeries(null);
      } finally {
        if (mounted) setCostLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const gcpCostChart = useMemo(() => {
    const provider = (costSeries?.providers || []).find(p => p.provider === 'gcp');
    const pts = provider?.series || [];
    const anomalies = provider?.anomalies || [];
    const iso = pts.map(p => new Date(p.t).toISOString());
    const labels = iso.map(ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const anomalyIso = new Set(anomalies.map(a => new Date(a.t).toISOString()));
    const latest = pts.length ? pts[pts.length - 1].cost || 0 : 0;
    const max = pts.reduce((m, p) => Math.max(m, p.cost || 0), 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'GCP Cost (USD)',
          data: pts.map(p => p.cost || 0),
          borderColor: '#059669',
          backgroundColor: 'rgba(5,150,105,0.18)',
          fill: true,
          tension: 0.25,
          pointRadius: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? 5 : 2,
          pointBackgroundColor: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? '#EF4444' : '#059669',
        }]
      },
      anomalies,
      stats: { latest, max, spikeCount: anomalies.length }
    };
  }, [costSeries]);

  const refreshLogs = async () => {
    setLoadingLogs(true);
    try {
      if (logMode === 'issues') {
        const params = { sinceMinutes: 120, limit: 200 };
        if (severity && (severity === 'ERROR' || severity === 'WARNING')) params.level = severity.toLowerCase();
        const res = await cloudGcpApi.getIssueLogs(params);
        setLogs(Array.isArray(res?.data?.data) ? res.data.data : []);
      } else {
        const params = { sinceMinutes: 120, limit: 200 };
        if (severity) params.severity = severity;
        if (logName) params.logName = logName;
        const res = await cloudGcpApi.getLogs(params);
        setAllLogs(Array.isArray(res?.data?.data) ? res.data.data : []);
      }
      try {
        const d = await cloudGcpApi.getDiag();
        setDiag(d?.data?.data || null);
      } catch {}
    } catch (_) { /* noop */ }
    finally { setLoadingLogs(false); }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">GCP Resources</Typography>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>GCP Cost (last 12h)</Typography>
        <Box sx={{ height: 240 }}>
          {costLoading ? (
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><CircularProgress size={20} /></Box>
          ) : gcpCostChart.data?.datasets?.[0]?.data?.length ? (
            <Line
              data={gcpCostChart.data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => {
                    const cost = Number(ctx.parsed.y || 0);
                    const ts = gcpCostChart.data.labels?.[ctx.dataIndex];
                    const anomaly = (gcpCostChart.anomalies || []).find(a => new Date(a.t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) === ts);
                    const sev = anomaly ? ` • spike +${anomaly.severity || 0}%` : '';
                    return `$${cost.toFixed(2)}${sev}`;
                  } } }
                },
                scales: { y: { title: { display: true, text: 'USD' } }, x: { grid: { display: false } } }
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">No recent GCP cost points.</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap:'wrap' }}>
          {(gcpCostChart.anomalies || []).map((a) => (
            <Chip key={a.t} size="small" color="error" label={`Spike ${new Date(a.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • $${Number(a.cost || a.latestCost || 0).toFixed(2)}`} />
          ))}
          {(gcpCostChart.anomalies || []).length === 0 && <Chip size="small" label="No spikes" />}
          <Chip size="small" color="primary" label={`Latest: $${Number(gcpCostChart.stats?.latest || 0).toFixed(2)}`} />
          <Chip size="small" label={`Max: $${Number(gcpCostChart.stats?.max || 0).toFixed(2)}`} />
          <Chip size="small" label={`Spikes: ${gcpCostChart.stats?.spikeCount || 0}`} />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          {projectId && <Chip color="default" variant="outlined" label={`Project: ${projectId}`} />}
          <Chip color="primary" label={`Compute Instances: ${counts.instances}`} />
          <Chip color="primary" label={`GKE Clusters: ${counts.clusters}`} />
          <Chip color="primary" label={`Buckets: ${counts.buckets}`} />
          <Chip color="primary" label={`Topics: ${counts.topics}`} />
          <Chip color="primary" label={`Subscriptions: ${counts.subscriptions}`} />
          {/* Surface backend-reported fetch errors per resource */}
          {errors?.instances && <Chip color="warning" variant="outlined" label={`Instances error: ${errors.instances}`} />}
          {errors?.clusters && <Chip color="warning" variant="outlined" label={`Clusters error: ${errors.clusters}`} />}
          {errors?.buckets && <Chip color="warning" variant="outlined" label={`Buckets error: ${errors.buckets}`} />}
          {errors?.topics && <Chip color="warning" variant="outlined" label={`Topics error: ${errors.topics}`} />}
          {errors?.subscriptions && <Chip color="warning" variant="outlined" label={`Subs error: ${errors.subscriptions}`} />}
        </Stack>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Typography color="warning.main">{error}</Typography>
        ) : ((counts.instances + counts.clusters + counts.buckets + counts.topics + counts.subscriptions) === 0) ? (
          <Typography variant="body2" color="text.secondary">
            No resources found for this project. If you expect data:
            • Verify the project ID and that the service account has viewer roles (Compute, Container, Storage, Pub/Sub).
            • Ensure the necessary Google APIs are enabled.
          </Typography>
        ) : null}
      </Paper>

      {/* GCP Logs */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6">GCP Logs</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {diag && (
              <Chip variant="outlined" label={`Diag: raw=${diag.rawCount} issues5m=${diag.issuesLast5m} logs5m=${diag.logsLast5m}`} />
            )}
            <Button size="small" onClick={refreshLogs} disabled={loadingLogs} startIcon={<RefreshIcon />}>Refresh</Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="log-mode-label">View</InputLabel>
            <Select labelId="log-mode-label" label="View" value={logMode} onChange={(e)=>setLogMode(e.target.value)}>
              <MenuItem value="issues">Issues (ERROR/WARN)</MenuItem>
              <MenuItem value="all">All Logs</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="severity-label">Severity</InputLabel>
            <Select labelId="severity-label" label="Severity" value={severity} onChange={(e)=>setSeverity(e.target.value)}>
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="ERROR">ERROR</MenuItem>
              <MenuItem value="WARNING">WARNING</MenuItem>
              <MenuItem value="INFO">INFO</MenuItem>
              <MenuItem value="NOTICE">NOTICE</MenuItem>
              <MenuItem value="DEBUG">DEBUG</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" label="Log Name contains" value={logName} onChange={(e)=>setLogName(e.target.value)} sx={{ minWidth: 260 }} />
          <Button variant="outlined" size="small" onClick={refreshLogs} disabled={loadingLogs}>Apply</Button>
        </Stack>

        {loading || loadingLogs ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>{logMode === 'issues' ? 'Level' : 'Severity'}</TableCell>
                  <TableCell>Log Name</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(logMode === 'issues' ? logs : allLogs).map((row, idx) => (
                  <TableRow key={row.eventId || `${idx}-${row.timestamp}`}>
                    <TableCell>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</TableCell>
                    <TableCell>{row.level || row.severity || '-'}</TableCell>
                    <TableCell title={row.logName} style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.logName}</TableCell>
                    <TableCell>{row.resource || '-'}</TableCell>
                    <TableCell title={row.message} style={{ maxWidth: 520, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.message}</TableCell>
                  </TableRow>
                ))}
                {((logMode === 'issues' ? logs : allLogs).length === 0) && (
                  <TableRow><TableCell colSpan={5}><Typography>No logs found for the selected filters.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Compute Instances */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Compute Engine Instances</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : instances.length === 0 ? (
          <Typography>No instances found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Zone</TableCell>
                  <TableCell>Machine Type</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.map((vm) => (
                  <TableRow key={vm.id}>
                    <TableCell>
                      <Link href={`https://console.cloud.google.com/compute/instancesDetail/zones/${vm.zone}/instances/${vm.name}`} target="_blank" rel="noopener">{vm.name}</Link>
                    </TableCell>
                    <TableCell>{vm.zone}</TableCell>
                    <TableCell>{vm.machineType || '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" color={vm.status === 'RUNNING' ? 'success' : 'default'} label={vm.status || '-'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* GKE Clusters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>GKE Clusters</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : clusters.length === 0 ? (
          <Typography>No clusters found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Nodes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clusters.map((c) => (
                  <TableRow key={`${c.location}-${c.name}`}>
                    <TableCell>
                      <Link href={`https://console.cloud.google.com/kubernetes/clusters/details/${c.location}/${c.name}/details`} target="_blank" rel="noopener">{c.name}</Link>
                    </TableCell>
                    <TableCell>{c.location}</TableCell>
                    <TableCell>
                      <Chip size="small" color={c.status === 'RUNNING' ? 'success' : 'default'} label={c.status || '-'} />
                    </TableCell>
                    <TableCell>{c.currentNodeCount ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Storage Buckets */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Cloud Storage Buckets</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : buckets.length === 0 ? (
          <Typography>No buckets found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {buckets.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`https://console.cloud.google.com/storage/browser/${encodeURIComponent(b.name)}`} target="_blank" rel="noopener">{b.name}</Link>
                    </TableCell>
                    <TableCell>{b.location}</TableCell>
                    <TableCell>{b.storageClass}</TableCell>
                    <TableCell>{b.timeCreated ? new Date(b.timeCreated).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Pub/Sub */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Pub/Sub Topics</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : topics.length === 0 ? (
          <Typography>No topics found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topics.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell>
                      <Link href={`https://console.cloud.google.com/cloudpubsub/topic/detail/${encodeURIComponent(t.name.split('/').pop())}`} target="_blank" rel="noopener">{t.name}</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Pub/Sub Subscriptions</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : subs.length === 0 ? (
          <Typography>No subscriptions found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Topic</TableCell>
                  <TableCell>Ack Deadline</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell>
                      <Link href={`https://console.cloud.google.com/cloudpubsub/subscription/detail/${encodeURIComponent(s.name.split('/').pop())}`} target="_blank" rel="noopener">{s.name}</Link>
                    </TableCell>
                    <TableCell>{s.topic}</TableCell>
                    <TableCell>{s.ackDeadlineSeconds ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
