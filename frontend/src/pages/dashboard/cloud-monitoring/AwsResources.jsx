import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cloudApi } from "../../../services/api/cloudApi";
import { cloudMetricApi } from "../../../services/api/cloudMetricApi";
import { Box, Typography, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Divider, Pagination, TextField, MenuItem, IconButton, Tooltip, Stack, InputAdornment, Select, FormControl, OutlinedInput } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend);

export default function AwsResources() {
  const [instances, setInstances] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [costSeries, setCostSeries] = useState(null);
  const [costLoading, setCostLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [instanceType, setInstanceType] = useState('all');
  const [region, setRegion] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('id'); // id | region | instanceType | avgCPU | networkIn | networkOut | launchTime
  const [sortDir, setSortDir] = useState('asc'); // asc | desc

  const formatBytes = (num) => {
    const n = Number(num || 0);
    if (n < 1024) return `${n}`;
    const units = ['KB','MB','GB','TB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length-1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
  };

  const cpuColor = (v) => {
    const n = Number(v || 0);
    if (n >= 85) return 'error';
    if (n >= 50) return 'warning';
    return 'success';
  };

  const fetchData = useCallback(async () => {
      try {
        // Prefer normalized endpoint
        const params = { page, limit };
        if (instanceType !== 'all') params.instanceType = instanceType;
        if (region !== 'all') params.region = region;
        const res = await cloudApi.getAwsInstances(params);
        if (res?.success) {
          setInstances(res.data?.instances || []);
          setTotal(res.data?.totalInstances || 0);
        } else {
          // Fallback to providers
          const prov = await cloudApi.getCloudProviderData();
          const aws = prov?.data?.aws || [];
          const flat = aws.flatMap(r => r.Instances || []).map(i => ({
            id: i.InstanceId,
            instanceType: i.InstanceType,
            avgCPU: 0,
            networkIn: 0,
            networkOut: 0,
            diskRead: 0,
            diskWrite: 0,
            region: 'us-east-1',
            state: i.State?.Name,
            publicIp: i.PublicIpAddress,
            privateIp: i.PrivateIpAddress,
            launchTime: i.LaunchTime
          }));
          setInstances(flat);
          setTotal(flat.length);
        }
      } catch (e) {
        setError(e?.message || "Failed to load AWS data");
      } finally {
        setLoading(false);
      }
  }, [page, limit, instanceType, region]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Cost line for AWS
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCostLoading(true);
        const res = await cloudMetricApi.getCostSeries({ sinceHours: 12 });
        if (!mounted) return;
        setCostSeries(res?.data || res);
      } catch (e) {
        if (mounted) setCostSeries(null);
      } finally {
        if (mounted) setCostLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Compute memos BEFORE any early returns to keep hook order stable
  const pagedTotalPages = Math.max(1, Math.ceil(total / limit));
  const instanceTypes = useMemo(() => {
    const set = new Set(instances.map(i => i.instanceType).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [instances]);
  const regions = useMemo(() => {
    const set = new Set(instances.map(i => i.region).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [instances]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return instances;
    return instances.filter(i => (
      String(i.id||'').toLowerCase().includes(term) ||
      String(i.publicIp||'').toLowerCase().includes(term) ||
      String(i.privateIp||'').toLowerCase().includes(term) ||
      String(i.instanceType||'').toLowerCase().includes(term) ||
      String(i.region||'').toLowerCase().includes(term)
    ));
  }, [instances, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      const dir = sortDir === 'asc' ? 1 : -1;
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * dir;
      if (bv == null) return 1 * dir;
      if (sortBy === 'avgCPU' || sortBy === 'networkIn' || sortBy === 'networkOut' || sortBy === 'launchTime') {
        const an = sortBy === 'launchTime' ? new Date(av).getTime() : Number(av);
        const bn = sortBy === 'launchTime' ? new Date(bv).getTime() : Number(bv);
        return (an - bn) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const summary = useMemo(() => {
    const count = sorted.length;
    const cpuAvg = count ? Math.round((sorted.reduce((s,i)=> s + (Number(i.avgCPU)||0), 0) / count) * 10)/10 : 0;
    const netIn = sorted.reduce((s,i)=> s + (Number(i.networkIn)||0), 0);
    const netOut = sorted.reduce((s,i)=> s + (Number(i.networkOut)||0), 0);
    return { count, cpuAvg, netIn, netOut };
  }, [sorted]);

  const awsCostChart = useMemo(() => {
    const provider = (costSeries?.providers || []).find(p => p.provider === 'aws');
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
          label: 'AWS Cost (USD)',
          data: pts.map(p => p.cost || 0),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.18)',
          fill: true,
          tension: 0.25,
          pointRadius: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? 5 : 2,
          pointBackgroundColor: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? '#EF4444' : '#F59E0B',
        }]
      },
      anomalies,
      stats: { latest, max, spikeCount: anomalies.length }
    };
  }, [costSeries]);

  const onHeaderClick = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const cols = ['id','region','state','publicIp','privateIp','instanceType','avgCPU','networkIn','networkOut','launchTime'];
    const header = cols.join(',');
    const rows = sorted.map(i => cols.map(k => {
      const val = i[k] == null ? '' : i[k];
      const str = typeof val === 'string' ? val : (k==='launchTime' && val ? new Date(val).toISOString() : String(val));
      return '"' + str.replace(/"/g,'""') + '"';
    }).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aws-resources-${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <>
      {/* Header toolbar */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:1.5 }}>
        <Typography variant="h5">AWS Resources</Typography>
        <Box>
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={() => { setLoading(true); fetchData(); }} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export CSV (current view)">
            <IconButton size="small" onClick={exportCsv}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap:'wrap' }}>
        <Chip color="primary" label={`Instances: ${summary.count}`} />
        <Chip color={cpuColor(summary.cpuAvg)} label={`Avg CPU: ${summary.cpuAvg}%`} />
        <Chip label={`Net In: ${formatBytes(summary.netIn)}`} />
        <Chip label={`Net Out: ${formatBytes(summary.netOut)}`} />
      </Stack>

      {/* Cost pulse (AWS only) */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>AWS Cost (last 12h)</Typography>
        <Box sx={{ height: 260 }}>
          {costLoading ? (
            <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%' }}><CircularProgress size={20} /></Box>
          ) : awsCostChart.data?.datasets?.[0]?.data?.length ? (
            <Line
              data={awsCostChart.data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => {
                    const cost = Number(ctx.parsed.y || 0);
                    const ts = awsCostChart.data.labels?.[ctx.dataIndex];
                    const isoTs = awsCostChart.data.labels?.[ctx.dataIndex];
                    const anomaly = (awsCostChart.anomalies || []).find(a => new Date(a.t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) === ts);
                    const sev = anomaly ? ` • spike +${anomaly.severity || 0}%` : '';
                    return `$${cost.toFixed(2)}${sev}`;
                  } } }
                },
                scales: {
                  y: { title: { display: true, text: 'USD' } },
                  x: { grid: { display: false } }
                }
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">No recent AWS cost points.</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap:'wrap' }}>
          {(awsCostChart.anomalies || []).map((a) => (
            <Chip key={a.t} size="small" color="error" label={`Spike ${new Date(a.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • $${Number(a.cost || a.latestCost || 0).toFixed(2)}`} />
          ))}
          {(awsCostChart.anomalies || []).length === 0 && (
            <Chip size="small" label="No spikes" />
          )}
          <Chip size="small" color="primary" label={`Latest: $${Number(awsCostChart.stats?.latest || 0).toFixed(2)}`} />
          <Chip size="small" label={`Max: $${Number(awsCostChart.stats?.max || 0).toFixed(2)}`} />
          <Chip size="small" label={`Spikes: ${awsCostChart.stats?.spikeCount || 0}`} />
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p:2, mb:2, display:'flex', gap:1, alignItems:'center', flexWrap:'wrap' }}>
        <TextField
          placeholder="Search (ID, IP, type, region)"
          size="small"
          value={search}
          onChange={(e)=>{ setPage(1); setSearch(e.target.value); }}
          InputProps={{ startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>
          )}}
          sx={{ minWidth: 260 }}
        />
        <TextField
          label="Instance Type"
          select size="small" value={instanceType}
          onChange={(e)=>{ setPage(1); setInstanceType(e.target.value); }}
        >
          {instanceTypes.map((t)=> (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Region"
          select size="small" value={region}
          onChange={(e)=>{ setPage(1); setRegion(e.target.value); }}
        >
          {regions.map((r)=> (
            <MenuItem key={r} value={r}>{r}</MenuItem>
          ))}
        </TextField>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <TextField
            label="Page size"
            select value={limit}
            onChange={(e)=> { setPage(1); setLimit(Number(e.target.value)); }}
          >
            {[10,25,50,100].map(n => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </TextField>
        </FormControl>
        <Divider flexItem orientation="vertical" sx={{ mx:1 }} />
        <Chip size="small" color="primary" label={`Total: ${total}`} />
        <Chip size="small" label={`Page: ${page}/${pagedTotalPages}`} />
      </Paper>

      {Array.isArray(instances) && instances.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell onClick={()=>onHeaderClick('id')} sx={{ cursor:'pointer' }}>Instance ID</TableCell>
                <TableCell onClick={()=>onHeaderClick('region')} sx={{ cursor:'pointer' }}>Region</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Public IP</TableCell>
                <TableCell>Private IP</TableCell>
                <TableCell onClick={()=>onHeaderClick('instanceType')} sx={{ cursor:'pointer' }}>Type</TableCell>
                <TableCell onClick={()=>onHeaderClick('avgCPU')} align="right" sx={{ cursor:'pointer' }}>avgCPU %</TableCell>
                <TableCell onClick={()=>onHeaderClick('networkIn')} align="right" sx={{ cursor:'pointer' }}>Net In</TableCell>
                <TableCell onClick={()=>onHeaderClick('networkOut')} align="right" sx={{ cursor:'pointer' }}>Net Out</TableCell>
                <TableCell onClick={()=>onHeaderClick('launchTime')} sx={{ cursor:'pointer' }}>Launched</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.id}</TableCell>
                  <TableCell>{i.region || '-'}</TableCell>
                  <TableCell>
                    {i.state ? (
                      <Chip size="small" label={i.state} color={i.state === 'running' || i.state === 'Running' ? 'success' : 'default'} />
                    ) : '-' }
                  </TableCell>
                  <TableCell>{i.publicIp || '-'}</TableCell>
                  <TableCell>{i.privateIp || '-'}</TableCell>
                  <TableCell>{i.instanceType}</TableCell>
                  <TableCell align="right">
                    {typeof i.avgCPU === 'number' ? (
                      <Chip size="small" color={cpuColor(i.avgCPU)} label={`${i.avgCPU}%`} />
                    ) : '0'}
                  </TableCell>
                  <TableCell align="right">{formatBytes(i.networkIn)}</TableCell>
                  <TableCell align="right">{formatBytes(i.networkOut)}</TableCell>
                  <TableCell>{i.launchTime ? new Date(i.launchTime).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 3, textAlign:'center' }}>
          <Typography>No AWS instances found.</Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>Try adjusting filters or refresh.</Typography>
        </Paper>
      )}

      {/* Pagination */}
      {total > limit && (
        <Box sx={{ display:'flex', justifyContent:'center', mt:2 }}>
          <Pagination count={pagedTotalPages} page={page} onChange={(_e, val)=>setPage(val)} shape="rounded" color="primary" />
        </Box>
      )}
    </>
  );
}
