import React, { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import { Box, Grid, Paper, Stack, Typography, TextField, ToggleButton, ToggleButtonGroup, Slider, Chip, IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel, Skeleton } from '@mui/material';
import { Line, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend, ArcElement } from 'chart.js';
import dayjs from 'dayjs';
import { carbonRealtimeApi } from '../../services/api/carbonRealtimeApi';
import { cloudApi } from '../../services/api/cloudApi';
import { io } from 'socket.io-client';
import DownloadIcon from '@mui/icons-material/Download';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { motion } from 'framer-motion';
import { useTheme, alpha } from '@mui/material/styles';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend, ArcElement);

const toISO = (d) => dayjs(d).format('YYYY-MM-DD');

function fmtCO2(value, unit) {
  const v = Number(value || 0);
  if (unit === 't') return `${(v/1000).toFixed(3)} t`; // kg -> t
  if (unit === 'lbs') return `${(v*2.20462).toFixed(2)} lbs`; // kg -> lbs
  return `${v.toFixed(2)} kg`;
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')));
  return lines.join('\n');
}

export default function Analytics() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  // Brand-forward palette for clearer contrast
  const awsColor = '#F59E0B'; // Amber 500
  const azureColor = '#2563EB'; // Blue 600
  const gcpColor = '#059669'; // Emerald 600
  const awsBg = alpha(awsColor, 0.9);
  const azureBg = alpha(azureColor, 0.9);
  const gcpBg = alpha(gcpColor, 0.9);
  const pieColors = [awsBg, azureBg, gcpBg];
  const providerColor = (prov) => (prov === 'aws' ? awsColor : prov === 'azure' ? azureColor : gcpColor);
  // State
  const [sinceMinutes, setSinceMinutes] = useState(() => parseInt(localStorage.getItem('ana_since') || '180', 10));
  const [realtime, setRealtime] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [unit, setUnit] = useState(localStorage.getItem('ana_unit') || 'kg'); // kg | t | lbs
  const [budget, setBudget] = useState(parseFloat(localStorage.getItem('ana_budget') || '1000'));
  const [scenario, setScenario] = useState(() => ({ migratePct: parseInt(localStorage.getItem('ana_migratePct') || '0', 10), target: localStorage.getItem('ana_target') || 'gcp' }));
  const [horizonDays, setHorizonDays] = useState(90);
  const socketRef = useRef(null);
  const [lastRealtime, setLastRealtime] = useState(null);
  const [loadingRealtime, setLoadingRealtime] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Load data
  async function loadRealtime(mins = sinceMinutes) {
    try {
      setLoadingRealtime(true);
      const data = await carbonRealtimeApi.getRealtime({ sinceMinutes: mins });
      setLastRealtime(realtime);
      setRealtime(data);
    } finally {
      setLoadingRealtime(false);
    }
  }
  async function loadDashboard() {
    try {
      setLoadingDashboard(true);
      const d = await cloudApi.getDashboard();
      setDashboard(d?.data || d || null);
    } catch {}
    finally { setLoadingDashboard(false); }
  }

  useEffect(() => { loadRealtime(sinceMinutes); loadDashboard(); }, []);
  useEffect(() => { localStorage.setItem('ana_since', String(sinceMinutes)); }, [sinceMinutes]);
  useEffect(() => { localStorage.setItem('ana_unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('ana_budget', String(budget)); }, [budget]);
  useEffect(() => { localStorage.setItem('ana_migratePct', String(scenario.migratePct)); localStorage.setItem('ana_target', scenario.target); }, [scenario]);

  // Live socket refresh
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5050', { transports: ['websocket'], auth: { token } });
      socketRef.current = s;
      s.on('connect', () => {});
      const refresh = () => loadRealtime(sinceMinutes);
      s.on('cloud:aws:instances', refresh);
      s.on('cloud:azure:instances', refresh);
      s.on('cloud:gcp:instances', refresh);
      return () => { s.disconnect(); };
    } catch { /* ignore */ }
  }, [sinceMinutes]);

  // Derived values
  const providers = useMemo(() => realtime?.providers || [], [realtime]);
  const totals = realtime?.totals || { gb:0, kWh:0, kgCO2:0, cost:0 };
  const intensity = realtime?.intensity || { kgPerGB:0, kgPerKWh:0 };

  // Provider share charts: use dashboard overview when available; fallback to realtime last N points
  const providerShares = useMemo(() => {
    const provs = dashboard?.overview?.providers || (providers?.map(p => ({ provider: p.provider, kgCO2: (p.series||[]).slice(-12).reduce((s,r)=>s+r.v,0), cost: p.cost || 0 })) || []);
    const byProv = provs.reduce((acc, p) => {
      const key = (p.provider || '').toLowerCase();
      const prev = acc[key] || { provider: key, kgCO2: 0, cost: 0 };
      acc[key] = { provider: key, kgCO2: prev.kgCO2 + (p.kgCO2 || 0), cost: prev.cost + (p.cost || 0) };
      return acc;
    }, {});
    const list = ['aws','azure','gcp'].map(k => byProv[k] || { provider: k, kgCO2: 0, cost: 0 });
    const totalsAgg = list.reduce((s, p) => ({ kgCO2: s.kgCO2 + p.kgCO2, cost: s.cost + p.cost }), { kgCO2: 0, cost: 0 });
    return { list, totals: totalsAgg };
  }, [dashboard, providers]);

  const emissionsPieData = useMemo(() => ({
    labels: providerShares.list.map(p => p.provider.toUpperCase()),
    datasets: [{
      data: providerShares.list.map(p => Number(p.kgCO2 || 0)),
      backgroundColor: pieColors,
      borderColor: [awsColor, azureColor, gcpColor],
      borderWidth: 2
    }]
  }), [providerShares, pieColors]);

  const costPieData = useMemo(() => ({
    labels: providerShares.list.map(p => p.provider.toUpperCase()),
    datasets: [{
      data: providerShares.list.map(p => Number(p.cost || 0)),
      backgroundColor: pieColors,
      borderColor: [awsColor, azureColor, gcpColor],
      borderWidth: 2
    }]
  }), [providerShares, pieColors]);

  const emissionsTotal = useMemo(() => providerShares.list.reduce((s,p)=> s + (Number(p.kgCO2)||0), 0), [providerShares]);
  const costTotal = useMemo(() => providerShares.list.reduce((s,p)=> s + (Number(p.cost)||0), 0), [providerShares]);
  const placeholderPie = useMemo(() => ({
    labels: ['AWS','AZURE','GCP'],
    datasets: [{ data: [1,1,1], backgroundColor: [awsBg, azureBg, gcpBg], borderColor: [awsColor, azureColor, gcpColor], borderWidth: 2 }]
  }), [awsBg, azureBg, gcpBg, awsColor, azureColor, gcpColor]);

  // Custom plugin to render percentage labels on pie slices
  const pieLabelPlugin = useMemo(() => ({
    id: 'pieLabelPlugin',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      if (!dataset) return;
      const data = (dataset.data || []).map(Number);
      const sum = data.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0);
      if (!sum) return;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
  ctx.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      for (let i = 0; i < meta.data.length; i++) {
        const arc = meta.data[i];
        const val = data[i] || 0;
        const pct = val / sum * 100;
        if (pct < 3) continue; // skip tiny slices to avoid clutter
        const { startAngle, endAngle, innerRadius, outerRadius, x, y } = arc.getProps(['startAngle','endAngle','innerRadius','outerRadius','x','y'], true);
        const angle = (startAngle + endAngle) / 2;
        const r = (innerRadius + outerRadius) / 2;
        const tx = x + r * Math.cos(angle);
        const ty = y + r * Math.sin(angle);
        const text = `${pct.toFixed(0)}%`;
        // Stroke for contrast, then fill with theme text
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeText(text, tx, ty);
  ctx.fillStyle = '#ffffff';
        ctx.fillText(text, tx, ty);
      }
      ctx.restore();
    }
  }), [isDark, textPrimary]);

  const budgetRingData = useMemo(() => {
    const spent = Number(totals.cost || 0);
    const remaining = Math.max(0, Math.max(budget - spent, 0));
    return {
      labels: ['Spent', 'Remaining'],
      datasets: [{
        data: [spent, remaining],
        backgroundColor: ['#EF4444', '#10B981'],
        borderWidth: 0
      }]
    };
  }, [totals, budget]);

  // Efficiency KPIs
  const kpis = useMemo(() => ({
    co2PerDollar: totals.cost>0 ? (totals.kgCO2 / totals.cost) : 0,
    co2PerGB: intensity.kgPerGB,
    co2PerKWh: intensity.kgPerKWh,
  }), [totals, intensity]);

  // Anomaly detection (client-side): mark points above 60% over 30m median per provider
  const anomalies = useMemo(() => {
    const out = [];
    for (const p of providers) {
      const series = p.series || [];
      if (series.length < 10) continue;
      const vals = series.map(s => s.v);
      const sorted = [...vals].sort((a,b)=>a-b);
      const median = sorted[Math.floor(sorted.length/2)] || 0;
      series.forEach((pt) => {
        if (pt.v > median * 1.6) out.push({ provider: p.provider, t: pt.t, value: pt.v, median });
      });
    }
    return out.sort((a,b)=> new Date(b.t) - new Date(a.t)).slice(0,6);
  }, [providers]);

  // Intensity ranking
  const intensityRank = useMemo(() => (providers.map(p => ({ provider: p.provider, kgPerKWh: p.intensity?.kgPerKWh || 0 }))
      .sort((a,b)=> b.kgPerKWh - a.kgPerKWh)), [providers]);

  // Forecast (client-side baseline): last 12 points average per provider -> next N with band; include scenario migration effect
  const providerForecast = useMemo(() => {
    const horizon = horizonDays;
    return providers.map(p => {
      const tail = (p.series || []).slice(-12);
      const base = tail.length ? tail.reduce((s,r)=> s+r.v,0)/tail.length : 0;
      const greener = providers.reduce((best, x)=> (x.intensity.kgPerKWh < best.intensity.kgPerKWh ? x : best), providers[0] || { intensity: { kgPerKWh: 1e9 } });
      const migrateToGreener = scenario.target === (greener?.provider || 'gcp');
      const deltaIntensity = (p.intensity.kgPerKWh || 0) - (greener?.intensity.kgPerKWh || 0);
      const reductionFactor = migrateToGreener && scenario.migratePct>0 ? (1 - (scenario.migratePct/100) * (deltaIntensity>0 ? 0.5 : 0)) : 1;
      const series = [];
      for (let i=1;i<=horizon;i++) {
        const wiggle = 0.06*Math.sin(i/6);
        const y = Math.max(0, base * (1+wiggle) * reductionFactor);
        const yLow = y*0.9; const yHigh = y*1.1;
        const date = new Date(Date.now() + i*60*1000*(realtime?.range?.bucketMs? (realtime.range.bucketMs/60000) : 5));
        series.push({ date, y, yLow, yHigh });
      }
      return { provider: p.provider, series };
    });
  }, [providers, horizonDays, scenario, realtime]);

  const overlayData = useMemo(() => {
    const labels = (providers[0]?.series || []).map(s => dayjs(s.t).format('HH:mm'));
    const ds = providers.map((p, idx) => ({
      label: `${p.provider.toUpperCase()} CO₂`,
      data: p.series.map(s=> s.v),
      borderColor: (p.provider === 'aws' ? awsColor : p.provider === 'azure' ? azureColor : gcpColor),
      tension: 0.25,
      pointRadius: 0,
    }));
    return { labels, datasets: ds };
  }, [providers, awsColor, azureColor, gcpColor]);

  const overlayOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: textSecondary } },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        titleColor: textPrimary,
        bodyColor: textPrimary,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtCO2(ctx.parsed.y, unit)}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `CO₂ (${unit})`, color: textSecondary },
        ticks: {
          color: textSecondary,
          callback: (val) => unit==='kg' ? val : unit==='t' ? (val/1000) : (val*2.20462)
        },
        grid: { color: gridColor }
      },
      x: { grid: { display: false }, ticks: { color: textSecondary } }
    }
  }), [unit, textSecondary, textPrimary, gridColor, theme.palette.background.paper, theme.palette.divider]);

  const prevDeltas = useMemo(() => {
    if (!lastRealtime || !realtime) return null;
    const curr = realtime.totals?.kgCO2 || 0;
    const prev = lastRealtime.totals?.kgCO2 || 0;
    const pct = prev>0 ? ((curr-prev)/prev)*100 : 0;
    return { pct, sign: pct>0?'+':'' };
  }, [lastRealtime, realtime]);

  const freshness = useMemo(() => {
    if (!realtime?.range?.to) return null;
    const sec = Math.max(0, Math.round((Date.now() - new Date(realtime.range.to).getTime())/1000));
    return `${sec}s ago`;
  }, [realtime]);

  // Exports
  function exportJSON() {
    const payload = { realtime, dashboard };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download = `analytics_${toISO(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function exportCSV() {
    const rows = [];
    (providers||[]).forEach(p => (p.series||[]).forEach(s => rows.push({ provider: p.provider, time: s.t, kgCO2: s.v })));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`analytics_series_${toISO(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <Box sx={{ p:2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:2 }}>
          <Typography variant="h5">Insights & Analytics</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export JSON"><IconButton onClick={exportJSON}><DownloadIcon/></IconButton></Tooltip>
            <Tooltip title="Export CSV"><IconButton onClick={exportCSV}><DownloadIcon/></IconButton></Tooltip>
            <Chip icon={<AccessTimeIcon/>} label={`Freshness: ${freshness || '—'}`} size="small" />
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          {/* Provider summary chips with real totals */}
          <Grid item xs={12}>
            <Paper sx={{ p:1.5, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))', borderRadius: 2 }}>
              {(loadingDashboard && !dashboard) ? (
                <Skeleton variant="rectangular" width={200} height={28} />
              ) : (
                providerShares.list.map((p, idx) => (
                  <Chip key={p.provider}
                    label={`${p.provider.toUpperCase()}: ${fmtCO2(p.kgCO2, unit)} • $${Number(p.cost||0).toFixed(2)}`}
                    sx={{
                      bgcolor: ['rgba(255,153,0,0.12)','rgba(0,120,212,0.12)','rgba(66,133,244,0.12)'][idx%3],
                      color: 'inherit'
                    }}
                  />
                ))
              )}
            </Paper>
          </Grid>

          {/* Provider share pies */}
          <Grid item xs={12} md={6}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} sx={{ p:2, height: '100%', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Provider Emissions Share</Typography>
              <Box sx={{ height: 340 }}>
                {loadingRealtime ? (
                  <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 1 }} />
                ) : (
                  <Pie data={emissionsTotal>0 ? emissionsPieData : placeholderPie} options={{ maintainAspectRatio:false, plugins:{ legend:{ display: false }, tooltip:{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderWidth: 1, titleColor: textPrimary, bodyColor: textPrimary } } }} plugins={[pieLabelPlugin]} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">Total: {fmtCO2(providerShares.totals.kgCO2, unit)}</Typography>
              {(!loadingRealtime && emissionsTotal<=0) && (
                <Typography variant="caption" color="text.secondary">No emissions recorded in the recent window.</Typography>
              )}
              {/* Custom legend with percentages */}
              {!loadingRealtime && (
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {providerShares.list.map((p) => {
                    const color = providerColor(p.provider);
                    const pct = emissionsTotal>0 ? (p.kgCO2 / emissionsTotal * 100) : 0;
                    return (
                      <Stack key={p.provider} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 160, justifyContent: 'center' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="body2" color={textPrimary}>{p.provider.toUpperCase()} {pct.toFixed(1)}%</Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} sx={{ p:2, height: '100%', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Provider Cost Share</Typography>
              <Box sx={{ height: 340 }}>
                {loadingRealtime ? (
                  <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 1 }} />
                ) : (
                  <Pie data={costTotal>0 ? costPieData : placeholderPie} options={{ maintainAspectRatio:false, plugins:{ legend:{ display: false }, tooltip:{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderWidth: 1, titleColor: textPrimary, bodyColor: textPrimary } } }} plugins={[pieLabelPlugin]} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">Total: ${Number(providerShares.totals.cost||0).toFixed(2)}</Typography>
              {(!loadingRealtime && costTotal<=0) && (
                <Typography variant="caption" color="text.secondary">No costs recorded in the recent window.</Typography>
              )}
              {/* Custom legend with percentages */}
              {!loadingRealtime && (
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {providerShares.list.map((p) => {
                    const color = providerColor(p.provider);
                    const pct = costTotal>0 ? (p.cost / costTotal * 100) : 0;
                    return (
                      <Stack key={p.provider} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 160, justifyContent: 'center' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="body2" color={textPrimary}>{p.provider.toUpperCase()} {pct.toFixed(1)}%</Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} sx={{ p:2, height: '100%', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Budget Progress</Typography>
              <Doughnut data={budgetRingData} options={{ cutout: '70%', plugins:{ legend:{ position:'bottom' } } }} />
              <Typography variant="caption" color="text.secondary">Budget: ${Number(budget).toFixed(2)} • Spent: ${Number(totals.cost||0).toFixed(2)}</Typography>
            </Paper>
          </Grid>

          {/* Overlay Multi-metric: Using CO2 by provider */}
          <Grid item xs={12} md={8}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} sx={{ p:2, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', backdropFilter: 'blur(6px)', borderRadius: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:1 }}>
                <Typography variant="subtitle2">Multi-metric Overlay (CO₂)</Typography>
                <Box sx={{ flex:1 }} />
                <Typography variant="caption">Window: {realtime?.range?.sinceMinutes}m</Typography>
                <Box sx={{ width: 240 }}>
                  <Slider min={15} max={720} step={15} value={sinceMinutes} onChange={(_,v)=> setSinceMinutes(v)} onChangeCommitted={()=> loadRealtime(sinceMinutes)} />
                </Box>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select label="Unit" value={unit} onChange={(e)=> setUnit(e.target.value)}>
                    <MenuItem value="kg">kg CO₂</MenuItem>
                    <MenuItem value="t">t CO₂e</MenuItem>
                    <MenuItem value="lbs">lbs CO₂</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Box sx={{ height: 300 }}>
                {loadingRealtime ? (
                  <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
                ) : (
                  <Line data={overlayData} options={overlayOptions} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">Compare to previous: {prevDeltas ? `${prevDeltas.sign}${prevDeltas.pct.toFixed(1)}%` : '—'}</Typography>
            </Paper>
          </Grid>

          {/* KPIs & Budget */}
          <Grid item xs={12} md={4}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} sx={{ p:2, mb:2, background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Efficiency KPIs</Typography>
              <Stack spacing={0.5}>
                {loadingRealtime ? (
                  <>
                    <Skeleton width={180} />
                    <Skeleton width={160} />
                    <Skeleton width={150} />
                  </>
                ) : (
                  <>
                    <Typography variant="body2">CO₂ / $: {kpis.co2PerDollar.toFixed(3)} kg per USD</Typography>
                    <Typography variant="body2">CO₂ / GB: {kpis.co2PerGB.toFixed(6)} kg per GB</Typography>
                    <Typography variant="body2">CO₂ / kWh: {kpis.co2PerKWh.toFixed(3)} kg per kWh</Typography>
                  </>
                )}
              </Stack>
            </Paper>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} sx={{ p:2, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Carbon Budget Tracker</Typography>
                <TextField size="small" type="number" label="Budget $/mo" value={budget} onChange={(e)=> setBudget(Math.max(0, parseFloat(e.target.value||'0')))} sx={{ width: 140 }} />
              </Stack>
              <Typography variant="body2" sx={{ mt:1 }}>Current spend (window): ${Number(totals.cost||0).toFixed(2)}</Typography>
              <Typography variant="body2">Status: {totals.cost > budget ? 'Over budget' : totals.cost > budget*0.8 ? 'At risk' : 'On track'}</Typography>
            </Paper>
          </Grid>

          {/* Forecasts per provider */}
          <Grid item xs={12}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} sx={{ p:2, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', borderRadius: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:1 }}>
                <Typography variant="subtitle2">Emissions Forecast (next {horizonDays} buckets)</Typography>
                <Box sx={{ flex:1 }} />
                <TextField size="small" type="number" label="Horizon" value={horizonDays} onChange={(e)=> setHorizonDays(Math.max(12, parseInt(e.target.value||'90',10)))} sx={{ width: 120 }} />
                <Typography variant="caption">Scenario: migrate {scenario.migratePct}% to <strong>{scenario.target.toUpperCase()}</strong></Typography>
                <Box sx={{ width: 200 }}>
                  <Slider min={0} max={100} step={5} value={scenario.migratePct} onChange={(_,v)=> setScenario(s=> ({ ...s, migratePct: v }))} />
                </Box>
                <ToggleButtonGroup exclusive size="small" value={scenario.target} onChange={(e,val)=> val && setScenario(s=> ({ ...s, target: val }))}>
                  <ToggleButton value="aws">AWS</ToggleButton>
                  <ToggleButton value="azure">Azure</ToggleButton>
                  <ToggleButton value="gcp">GCP</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Grid container spacing={2}>
                {providerForecast.map(p => {
                  const labels = p.series.map(s=> dayjs(s.date).format('HH:mm'));
                  const data = p.series.map(s=> s.y);
                  const low = p.series.map(s=> s.yLow);
                  const high = p.series.map(s=> s.yHigh);
                  return (
                    <Grid item xs={12} md={4} key={p.provider}>
                      <Paper variant="outlined" sx={{ p:1.5, background: 'linear-gradient(135deg, rgba(66,133,244,0.06), rgba(0,0,0,0.02))', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">{p.provider.toUpperCase()}</Typography>
                        <Box sx={{ height: 180 }}>
                          <Line data={{ labels, datasets:[
                            { label:'Forecast', data, borderColor:'#3b82f6', pointRadius:0, tension:0.25 },
                            { label:'Low', data:low, borderColor:'rgba(59,130,246,0.25)', pointRadius:0 },
                            { label:'High', data:high, borderColor:'rgba(59,130,246,0.25)', pointRadius:0, fill:'-1', backgroundColor:'rgba(59,130,246,0.08)' },
                          ] }} options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: (ctx)=> fmtCO2(ctx.parsed.y, unit) } } }, scales:{ y:{ ticks:{ precision:0 } } } }} />
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          </Grid>

          {/* Anomalies & Intensity ranking */}
          <Grid item xs={12} md={6}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} sx={{ p:2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Anomaly Detection (spikes)</Typography>
              {anomalies.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No spikes detected in this window.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {anomalies.map((a, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{a.provider.toUpperCase()}</Typography>
                      <Typography variant="body2">{dayjs(a.t).format('HH:mm')}</Typography>
                      <Typography variant="body2">{fmtCO2(a.value, unit)} (median {fmtCO2(a.median, unit)})</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} sx={{ p:2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Provider Intensity Ranking</Typography>
              {intensityRank.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {intensityRank.map((r, i) => (
                    <Stack key={r.provider} direction="row" justifyContent="space-between">
                      <Typography variant="body2">{i+1}. {r.provider.toUpperCase()}</Typography>
                      <Typography variant="body2">{(r.kgPerKWh||0).toFixed(3)} kg/kWh</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

        </Grid>
      </Box>
    </DashboardLayout>
  );
}
