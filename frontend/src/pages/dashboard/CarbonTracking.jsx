// src/pages/dashboard/CarbonTracking.jsx
import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "../../components/common/Layout/DashboardLayout";
import { Box, Typography, Paper, Grid, Skeleton, Chip, Stack, IconButton, Tooltip, Divider, ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, ToggleButtonGroup as MuiToggles } from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DownloadIcon from '@mui/icons-material/Download';
import { alpha } from '@mui/material/styles';

// ✅ Correct imports
import CloudIcon from "@mui/icons-material/Cloud";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SpeedIcon from "@mui/icons-material/Speed";
import StorageIcon from "@mui/icons-material/Storage";
import EmojiNatureIcon from "@mui/icons-material/EmojiNature"; // 🌱 Replaced Eco

import { cloudApi } from "../../services/api/cloudApi";
import { carbonRealtimeApi } from "../../services/api/carbonRealtimeApi";

// Hook: animated count-up for numeric values
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const startRef = React.useRef(null);
  const fromRef = React.useRef(0);
  useEffect(() => {
    if (target == null || isNaN(target)) return;
    fromRef.current = val; // animate from current displayed value
    let frame;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const next = fromRef.current + (target - fromRef.current) * eased;
      setVal(next);
      if (progress < 1) frame = requestAnimationFrame(animate); else startRef.current = null;
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

export default function CarbonTracking() {
  const [carbonData, setCarbonData] = useState(null); // monthly snapshot
  const [realtime, setRealtime] = useState(null); // realtime aggregation
  const [loading, setLoading] = useState(true);
  const [rtLoading, setRtLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sinceMinutes, setSinceMinutes] = useState(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [normalized, setNormalized] = useState(false);
  const [showTrends, setShowTrends] = useState(true);
  const [hoverPoint, setHoverPoint] = useState(null); // { provider, t, v, x, y }
  const [metric, setMetric] = useState('co2'); // 'co2' | 'cost'
  const [smooth, setSmooth] = useState(false);

  const loadRealtime = useCallback(async (minutes = sinceMinutes) => {
    try {
      setRtLoading(true);
      const data = await carbonRealtimeApi.getRealtime({ sinceMinutes: minutes });
      setRealtime(data);
      setLastUpdated(new Date());
      setRtLoading(false);
    } catch (e) {
      console.warn('Realtime carbon fetch failed', e.message);
      setRtLoading(false);
    }
  }, [sinceMinutes]);

  useEffect(() => {
    let intervalId;
    cloudApi.getCarbonFootprint()
      .then((data) => { setCarbonData(data?.data || null); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to fetch carbon data'); setLoading(false); });
    loadRealtime(sinceMinutes);
    if (autoRefresh) {
      intervalId = setInterval(() => loadRealtime(sinceMinutes), 60000);
    }
    return () => intervalId && clearInterval(intervalId);
  }, [autoRefresh, loadRealtime, sinceMinutes]);

  useEffect(()=>{
    // load persisted UI prefs
    try {
      const prefs = JSON.parse(localStorage.getItem('carbonRealtimePrefs')||'{}');
      if (typeof prefs.normalized === 'boolean') setNormalized(prefs.normalized);
      if (typeof prefs.showTrends === 'boolean') setShowTrends(prefs.showTrends);
      if (prefs.metric) setMetric(prefs.metric);
      if (typeof prefs.smooth === 'boolean') setSmooth(prefs.smooth);
    } catch {}
  },[]);
  useEffect(()=>{
    // persist UI prefs
    const prefs = { normalized, showTrends, metric, smooth };
    try { localStorage.setItem('carbonRealtimePrefs', JSON.stringify(prefs)); } catch {}
  }, [normalized, showTrends, metric, smooth]);

  // Aggregate per-provider values (AWS + Azure) for accuracy
  const providerAggregates = React.useMemo(()=>{
    const list = carbonData?.breakdownByProvider || [];
    if (!list.length) return { kgCO2: 0, cost: 0, activeInstances: 0, avgCPU: 0, weightedCPU: 0, providers: [] };
    let kgCO2 = 0, cost = 0, activeInstances = 0;
    let sumCpu = 0, countCpu = 0;
    let weightedCpuNumer = 0, weightedCpuDenom = 0;
    list.forEach(p => {
      const inst = Number(p.activeInstances || 0);
      const cpu = typeof p.avgCPU === 'number' ? p.avgCPU : null;
      kgCO2 += Number(p.kgCO2 || 0);
      cost += Number(p.cost || 0);
      activeInstances += inst;
      if (cpu != null) {
        sumCpu += cpu; countCpu += 1;
        weightedCpuNumer += cpu * (inst || 1); // if no instances, treat as 1 to not drop
        weightedCpuDenom += (inst || 1);
      }
    });
    const avgCPU = countCpu ? (sumCpu / countCpu) : 0;
    const weightedCPU = weightedCpuDenom ? (weightedCpuNumer / weightedCpuDenom) : avgCPU;
    return { kgCO2, cost, activeInstances, avgCPU, weightedCPU, providers: list };
  }, [carbonData]);

  // Build metrics array using aggregated provider data to ensure both AWS & AZURE reflected
  const metrics = React.useMemo(()=>[
    {
      label: "Total Emissions",
      raw: providerAggregates.kgCO2,
      format: (v)=> `${v.toFixed(2)} kg CO₂`,
      icon: <EmojiNatureIcon sx={{ color: "#2e7d32" }} />, // use hex instead of 'green'
      color: "#2e7d32",
      _type: 'emissions'
    },
    {
      label: "Efficiency Score",
      raw: typeof carbonData?.efficiencyScore === 'number' ? carbonData.efficiencyScore : null,
      format: (v)=> `${v.toFixed(1)}%`,
      icon: <SpeedIcon sx={{ color: "#1976d2" }} />,
      color: "#1976d2",
    },
    {
      label: "Active Instances",
      raw: providerAggregates.activeInstances,
      format: (v)=> `${Math.round(v)}`,
      icon: <CloudIcon sx={{ color: "#0288d1" }} />,
      color: "#0288d1",
    },
    {
      label: "Total Cost",
      raw: providerAggregates.cost,
      format: (v)=> `$${v.toFixed(2)}`,
      icon: <AttachMoneyIcon sx={{ color: "#f57c00" }} />,
      color: "#f57c00",
    },
    {
      label: "Avg CPU Usage",
      raw: typeof carbonData?.avgCPUUsage === 'number' ? carbonData.avgCPUUsage : providerAggregates.weightedCPU,
      format: (v)=> `${v.toFixed(1)}%`,
      icon: <StorageIcon sx={{ color: "#9c27b0" }} />,
      color: "#9c27b0",
      _type: 'cpu'
    },
  ], [carbonData, providerAggregates]);

  // Child component to safely use hooks per metric (avoids dynamic hook call order issues)
  // Build per-provider map with safe defaults for AWS/AZURE/GCP
  const providerMap = React.useMemo(() => {
    const list = carbonData?.breakdownByProvider || [];
    const map = new Map(list.map(p => [p.provider, p]));
    // ensure stable providers in UI
    if (!map.has('aws')) map.set('aws', { provider: 'aws', cost: 0, kgCO2: 0, avgCPU: 0, activeInstances: 0 });
    if (!map.has('azure')) map.set('azure', { provider: 'azure', cost: 0, kgCO2: 0, avgCPU: 0, activeInstances: 0 });
    if (!map.has('gcp')) map.set('gcp', { provider: 'gcp', cost: 0, kgCO2: 0, avgCPU: 0, activeInstances: 0 });
    return map;
  }, [carbonData]);

  const SubProvidersRow = ({ type }) => {
    // type: 'instances' | 'cost' | 'cpu' | 'emissions'
  const provs = ['aws','azure','gcp'];
    const formatVal = (prov) => {
      const p = providerMap.get(prov) || {};
      if (type === 'instances') return String(Math.round(p.activeInstances || 0));
      if (type === 'cost') return `$${Number(p.cost || 0).toFixed(2)}`;
      if (type === 'cpu') return `${Number(p.avgCPU || 0).toFixed(1)}%`;
      if (type === 'emissions') {
        const total = providerAggregates.kgCO2 || 1;
        const val = Number(p.kgCO2 || 0);
        const share = (val/total)*100;
        return `${val.toFixed(2)} kg (${share.toFixed(1)}%)`;
      }
      return '—';
    };
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap:'wrap' }}>
        {provs.map(prov => (
          <Chip
            key={`sub-${type}-${prov}`}
            size="small"
            variant="outlined"
            label={`${prov.toUpperCase()}: ${formatVal(prov)}`}
            sx={{
              borderColor: (theme)=>alpha(providerColor(prov), 0.6),
              color: providerColor(prov),
              bgcolor: (theme)=>alpha(providerColor(prov), 0.08)
            }}
          />
        ))}
      </Stack>
    );
  };

  const MetricsCards = ({ items }) => {
    return (
      <Grid container spacing={2}>
        {items.map((m, idx) => {
          const animatedVal = useCountUp(m.raw ?? 0, 900);
          const display = m.raw == null ? '—' : m.format(animatedVal);
          // Determine sub breakdown
          let subContent = null;
          if (m._type === 'emissions') subContent = <SubProvidersRow type="emissions" />;
          else if (m.label === 'Active Instances') subContent = <SubProvidersRow type="instances" />;
          else if (m.label === 'Total Cost') subContent = <SubProvidersRow type="cost" />;
          else if (m._type === 'cpu') subContent = <SubProvidersRow type="cpu" />;
          return (
            <Grid item xs={12} sm={6} md={4} key={m.label} sx={{
              animation: 'fadeSlide 600ms ease forwards',
              opacity:0,
              transform:'translateY(8px)',
              animationDelay: `${idx * 90}ms`
            }}>
              <AnimatedMetricCard icon={m.icon} label={m.label} value={display} color={m.color} subContent={subContent} />
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const providerChips = (() => {
    const list = realtime?.providers || [];
    const map = new Map(list.map(p => [p.provider, p]));
    const ensure = ['aws','azure','gcp'];
    ensure.forEach(k => { if (!map.has(k)) map.set(k, { provider: k, kgCO2: 0, intensity: { kgPerGB: 0, kgPerKWh: 0 } }); });
    return Array.from(map.values()).map(p => (
    <Tooltip key={p.provider} title={`Intensity: ${p.intensity.kgPerGB} kg/GB, ${p.intensity.kgPerKWh} kg/kWh`} placement="top" arrow>
      <Chip label={`${p.provider.toUpperCase()}: ${p.kgCO2} kg CO₂`} color="success" variant="outlined" />
    </Tooltip>
    ));
  })();
  const monthlyProviderChips = (carbonData?.breakdownByProvider || []).map(p => (
    <Chip key={`m-${p.provider}`} label={`${p.provider.toUpperCase()}: ${p.kgCO2} kg CO₂, $${p.cost}`} variant="outlined" />
  ));

  const applySmoothing = (series) => {
    if (!smooth || !series || series.length < 3) return series;
    // simple centered rolling mean window=3
    return series.map((pt,i)=>{
      if (i===0 || i===series.length-1) return pt; // keep edges
      const avg = (series[i-1].v + pt.v + series[i+1].v)/3;
      return { ...pt, v: avg };
    });
  };

  const Sparkline = ({ points = [], color = '#2e7d32', width, height = 34, normalize = false, provider }) => {
    const adjusted = applySmoothing(points);
    const values = adjusted.map(p => p.v);
    if (!values.length) return <Box sx={{ width, height }} />;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const normValues = normalize ? values.map(v => (v / (max || 1)) * 100) : values;
    const yMax = normalize ? 100 : max;
    const yMin = normalize ? 0 : min;
    const yRange = yMax - yMin || 1;
    const step = width / Math.max(1, normValues.length - 1);
    const coords = normValues.map((v,i) => {
      const x = i * step;
      const y = height - ((v - (normalize ? 0 : yMin)) / yRange) * (height - 6) - 3; // 3px vertical pad
      return { x, y, raw: adjusted[i] };
    });
    const path = coords.map((c,i)=>`${i===0?'M':'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');

    const onMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      // nearest point
      let nearest = coords[0];
      let dist = Math.abs(relX - nearest.x);
      for (let i=1;i<coords.length;i++) {
        const d = Math.abs(relX - coords[i].x);
        if (d < dist) { dist = d; nearest = coords[i]; }
      }
      setHoverPoint({ provider, t: nearest.raw.t, v: nearest.raw.v, x: nearest.x, y: nearest.y });
    };
    const onLeave = () => setHoverPoint(hp => hp && hp.provider===provider ? null : hp);

    const totalLengthRef = React.useRef(null);

    return (
      <Box sx={{ position:'relative', width, height }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <svg width={width} height={height} style={{ overflow:'visible', display:'block' }}>
          <defs>
            <linearGradient id={`spark-${provider}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.2" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={path}
            fill="none"
            stroke={`url(#spark-${provider})`}
            strokeWidth={2.2}
            strokeLinecap="round"
            style={{
              filter:'url(#glow)',
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: 'dashDraw 1.2s ease forwards'
            }}
          />
          {hoverPoint && hoverPoint.provider===provider && (
            <g>
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        </svg>
      </Box>
    );
  };

  const providerColor = (prov) => ({
    aws: '#FF9900',
    azure: '#0078D4',
    gcp: '#4285F4',
    default: '#2e7d32'
  })[prov] || '#2e7d32';

  const AUTO_SPARK_WIDTH = (seriesLen) => Math.min(220, Math.max(90, seriesLen * 14));

  const topProvider = realtime?.providers?.slice().sort((a,b)=> b.kgCO2 - a.kgCO2)[0];
  const providerSparklines = showTrends ? (realtime?.providers || []).map(p => {
    const series = p.series || [];
    const width = AUTO_SPARK_WIDTH(series.length);
    const isTop = topProvider && topProvider.provider === p.provider && !normalized && metric==='co2';
    return (
      <Paper key={p.provider} variant="outlined" sx={{ p:1.5, borderRadius:2, display:'flex', flexDirection:'column', gap:0.75, position:'relative',
        borderColor: isTop ? providerColor(p.provider) : 'divider',
        boxShadow: isTop ? (theme)=>`0 0 0 1px ${providerColor(p.provider)}, 0 4px 14px -2px ${alpha(providerColor(p.provider),0.5)}` : 'none',
        transition:'box-shadow 300ms ease, transform 300ms ease',
        '&:hover': { transform:'translateY(-3px)' }
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" sx={{ fontWeight:600 }}>{p.provider.toUpperCase()}</Typography>
          <Typography variant="caption" color="text.secondary">{metric==='co2' ? (normalized ? '0-100%' : `${p.kgCO2} kg`) : (p.cost ? `$${p.cost.toFixed(2)}` : '$—')}</Typography>
        </Stack>
        <Sparkline points={series} color={providerColor(p.provider)} normalize={normalized} provider={p.provider} width={width} />
        {isTop && (
          <Box sx={{
            position:'absolute',
            top:4,
            left:4,
            fontSize:9,
            fontWeight:700,
            letterSpacing:0.5,
            px:0.6,
            py:0.2,
            borderRadius:1,
            bgcolor:(theme)=>alpha(providerColor(p.provider),0.15),
            color: providerColor(p.provider)
          }}>TOP</Box>
        )}
      </Paper>
    );
  }) : [];

  const rangeLabel = realtime ? `${realtime.range.sinceMinutes}m window` : '';

  const AnimatedPaper = ({ children, ...rest }) => (
    <Paper
      {...rest}
      sx={{
        position:'relative',
        overflow:'hidden',
        '&:before': {
          content:'""',
          position:'absolute',
          inset:0,
          background: (theme)=>`linear-gradient(135deg, ${theme.palette.mode==='dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'} 0%, transparent 60%)`,
          opacity:0,
          transition:'opacity 400ms ease'
        },
        '&:hover:before': { opacity:1 },
        transition:'transform 240ms ease, box-shadow 240ms ease',
        '&:hover': { transform:'translateY(-2px)', boxShadow: (theme)=>theme.shadows[4] },
        ...rest.sx
      }}
    >{children}</Paper>
  );

  const buildCsv = () => {
    if (!realtime?.providers?.length) return '';
    // collect all unique timestamps
    const tsSet = new Set();
    realtime.providers.forEach(p => (p.series||[]).forEach(pt => tsSet.add(pt.t)));
    const timestamps = Array.from(tsSet).sort((a,b)=>a-b);
    const header = ['timestamp', ...realtime.providers.map(p=>p.provider.toUpperCase())];
    const rows = [header.join(',')];
    timestamps.forEach(t => {
      const cols = [new Date(t).toISOString()];
      realtime.providers.forEach(p => {
        const found = (p.series||[]).find(pt => pt.t===t);
        cols.push(found ? found.v.toFixed(6) : '');
      });
      rows.push(cols.join(','));
    });
    return rows.join('\n');
  };

  const handleDownload = () => {
    const csv = buildCsv();
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbon_series_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const CombinedStacked = ({ providers = [], height = 80 }) => {
    // only for absolute CO2 mode
    if (!providers.length || normalized || metric !== 'co2') return null;
    // gather union timestamps
    const tsSet = new Set();
    providers.forEach(p => (p.series||[]).forEach(pt => tsSet.add(pt.t)));
    const timestamps = Array.from(tsSet).sort((a,b)=>a-b);
    if (!timestamps.length) return null;
    // build stacked values per timestamp
    const stacked = timestamps.map(t => {
      const layers = providers.map(p => {
        const found = (p.series||[]).find(pt => pt.t===t);
        return { provider: p.provider, v: found ? found.v : 0 };
      });
      return { t, layers };
    });
    // compute cumulative max for scaling
    let globalMax = 0;
    stacked.forEach(row => {
      const total = row.layers.reduce((s,l)=>s+l.v,0);
      if (total > globalMax) globalMax = total;
    });
    if (globalMax === 0) globalMax = 1;
    const width = Math.min(600, Math.max(200, timestamps.length * 18));
    const barW = Math.max(4, width / (timestamps.length * 1.4));

    return (
      <Box sx={{ mt:2, position:'relative' }}>
        <Typography variant="caption" sx={{ mb:0.5, display:'block', fontWeight:600 }}>Combined Stacked (CO₂)</Typography>
        <Box sx={{ width, height, position:'relative', border: (theme)=>`1px solid ${theme.palette.divider}`, borderRadius:1, overflow:'hidden', bgcolor:(theme)=> theme.palette.mode==='dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
          <svg width={width} height={height}>
            {stacked.map((row, idx) => {
              let cum = 0;
              const x = (idx / (timestamps.length-1||1)) * (width - barW);
              return row.layers.map(layer => {
                const h = (layer.v / globalMax) * (height - 8);
                const y = height - 4 - cum - h;
                const color = providerColor(layer.provider);
                const rect = <rect key={layer.provider+row.t} x={x} y={y} width={barW} height={h} fill={color} opacity={0.85} />;
                cum += h;
                return rect;
              });
            })}
          </svg>
        </Box>
      </Box>
    );
  };

  const AnimatedMetricCard = ({ icon, label, value, color, subContent = null }) => {
    return (
      <Paper
        sx={{
          p: 2.5,
            borderRadius: 3,
            position:'relative',
            overflow:'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: (theme)=>`linear-gradient(135deg, ${alpha(color,0.12)}, ${alpha(color,0.04)})`,
            boxShadow: (theme)=>`0 4px 10px -2px ${alpha(color,0.4)}`,
            transition:'transform 320ms cubic-bezier(.21,1.02,.73,1)',
            '&:hover': { transform:'translateY(-4px) scale(1.015)' },
            '&:before':{
              content:'""', position:'absolute', inset:0,
              background:(theme)=>`radial-gradient(circle at 30% 20%, ${alpha(color,0.35)} 0%, transparent 60%)`,
              opacity:0.4, mixBlendMode:'overlay', pointerEvents:'none'
            }
        }}
      >
        {icon}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
          {subContent}
        </Box>
      </Paper>
    );
  };

  // Realtime totals panel with animated numbers
  const RealtimeTotals = ({ totals, intensity }) => {
    const co2 = useCountUp(Number(totals.kgCO2) || 0, 800);
    const kwh = useCountUp(Number(totals.kWh) || 0, 800);
    const gb = useCountUp(Number(totals.gb) || 0, 800);
    const cost = useCountUp(Number(totals.cost) || 0, 800);
    return (
      <Paper variant="outlined" sx={{ p:2, borderRadius:2, position:'relative', overflow:'hidden' }}>
        <Box sx={{ position:'absolute', inset:0, background:(theme)=>`linear-gradient(160deg, ${alpha(theme.palette.success.main, theme.palette.mode==='dark'?0.08:0.12)}, transparent)` }} />
        <Typography variant="subtitle2" gutterBottom sx={{ position:'relative' }}>Total (window)</Typography>
        <Stack spacing={0.4} sx={{ position:'relative' }}>
          <Typography variant="body2">CO₂: <strong>{co2.toFixed(3)} kg</strong></Typography>
          <Typography variant="body2">kWh: <strong>{kwh.toFixed(3)}</strong></Typography>
          <Typography variant="body2">GB: <strong>{gb.toFixed(3)}</strong></Typography>
          <Typography variant="body2">Cost: <strong>${cost.toFixed(2)}</strong></Typography>
          <Typography variant="caption" color="text.secondary">Intensity: {intensity.kgPerGB} kg/GB</Typography>
        </Stack>
      </Paper>
    );
  };

  return (
    <DashboardLayout>
      <style>{`
        @keyframes fadeSlide { 0% {opacity:0; transform:translateY(8px)} 100% {opacity:1; transform:translateY(0)} }
        @keyframes dashDraw { to { stroke-dashoffset: 0; } }
        @keyframes pulseDot { 0% { transform:scale(1); opacity:1 } 50% { transform:scale(.55); opacity:.5 } 100% { transform:scale(1); opacity:1 } }
        @keyframes shimmerMove { 0% { transform:translateX(-100%) } 100% { transform:translateX(120%) } }
      `}</style>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={700} mb={3}>
          Carbon Footprint & Tracking
        </Typography>

        {loading && (
          <Grid container spacing={2}>
            {[...Array(2)].map((_, i) => (
              <Grid item xs={12} md={6} key={i}>
                <Skeleton variant="rectangular" height={120} />
              </Grid>
            ))}
          </Grid>
        )}

        {error && (
          <Typography color="error" variant="body1">
            {error}
          </Typography>
        )}

        {!loading && carbonData && <MetricsCards items={metrics} />}

        {!loading && (carbonData?.breakdownByProvider || []).length > 0 && (
          <Box mt={2}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Monthly by Provider</Typography>
                {monthlyProviderChips}
              </Stack>
            </Paper>
          </Box>
        )}

        <Box mt={4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: 3, position:'relative', overflow:'hidden', background:(theme)=>`linear-gradient(140deg, ${alpha('#2e7d32', theme.palette.mode==='dark'?0.25:0.18)}, ${alpha('#1976d2', theme.palette.mode==='dark'?0.18:0.12)})` }}>
            <Box sx={{ position:'absolute', inset:0, pointerEvents:'none', background:(theme)=>`radial-gradient(circle at 85% 25%, ${alpha('#ffffff', theme.palette.mode==='dark'?0.08:0.25)} 0%, transparent 60%)` }} />
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h6" fontWeight={600}>Real-Time Emissions</Typography>
              <Chip icon={<AccessTimeIcon />} size="small" label={rangeLabel} />
              {rtLoading && <Chip size="small" label="Loading..." />}
              {providerChips}
              <Tooltip title="Refresh now">
                <IconButton size="small" onClick={() => loadRealtime(sinceMinutes)}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <ToggleButtonGroup size="small" value={sinceMinutes} exclusive onChange={(e,v)=>{ if(v){ setSinceMinutes(v); loadRealtime(v); } }}>
                {[15,30,60,240].map(v => <ToggleButton key={v} value={v}>{v}m</ToggleButton>)}
              </ToggleButtonGroup>
            </Stack>
            <Divider sx={{ my: 2 }} />
            {!realtime && rtLoading && (
              <Grid container spacing={2}>
                {[0,1].map(i => (
                  <Grid item xs={12} md={6} key={i}>
                    <Skeleton variant="rounded" height={140} />
                  </Grid>
                ))}
              </Grid>
            )}
            {realtime && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <RealtimeTotals totals={realtime.totals} intensity={realtime.intensity} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Last Updated</Typography>
                    <Typography variant="body2">{lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</Typography>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1, mt:0.5 }}>
                      {autoRefresh && (
                        <Box sx={{ position:'relative', width:14, height:14 }}>
                          <Box sx={{ position:'absolute', inset:0, bgcolor:'success.main', borderRadius:'50%', animation:'pulseDot 1.4s ease-in-out infinite' }} />
                          <Box sx={{ position:'absolute', inset:-6, borderRadius:'50%', border:(theme)=>`2px solid ${theme.palette.success.main}`, opacity:0.25 }} />
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary">Auto-refresh {autoRefresh ? 'ON' : 'OFF'} (60s)</Typography>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <AnimatedPaper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight:700, letterSpacing:0.4 }}>Provider CO₂ Trend</Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <FormControlLabel control={<Switch size="small" checked={normalized} onChange={(e)=>setNormalized(e.target.checked)} />} label="Normalized" labelPlacement="start" sx={{ m:0 }} />
                        <FormControlLabel control={<Switch size="small" checked={smooth} onChange={(e)=>setSmooth(e.target.checked)} />} label="Smooth" labelPlacement="start" sx={{ m:0 }} />
                        <FormControlLabel control={<Switch size="small" checked={showTrends} onChange={(e)=>setShowTrends(e.target.checked)} />} label="Show" labelPlacement="start" sx={{ m:0 }} />
                        <ToggleButtonGroup size="small" exclusive value={metric} onChange={(e,v)=> v && setMetric(v)} sx={{
                          borderRadius:999,
                          '& .MuiToggleButton-root': {
                            textTransform:'none',
                            fontWeight:600,
                            px:1.6,
                            transition:'all .25s',
                            '&.Mui-selected': {
                              background:(theme)=>alpha(theme.palette.primary.main,0.22),
                              color:(theme)=>theme.palette.primary.main,
                            }
                          }
                        }}>
                          <ToggleButton value="co2">CO₂</ToggleButton>
                          <ToggleButton value="cost">Cost</ToggleButton>
                        </ToggleButtonGroup>
                        <Tooltip title="Download CSV of current provider time buckets" arrow>
                          <span style={{ display:'inline-flex' }}>
                            <IconButton size="small" onClick={handleDownload} disabled={!realtime?.providers?.length}>
                              <DownloadIcon fontSize="inherit" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    {showTrends && (
                      <>
                        <Grid container spacing={1}>
                          {providerSparklines.map((el,i)=>(
                            <Grid key={i} item xs={12} sm={6} md={4} lg={3} xl={2}>{el}</Grid>
                          ))}
                        </Grid>
                        <CombinedStacked providers={realtime.providers} />
                      </>
                    )}
                    {!showTrends && <Typography variant="caption" color="text.secondary">Trends hidden</Typography>}
                    <Typography variant="caption" color="text.secondary" sx={{ mt:1, display:'block' }}>
                      Buckets: {realtime.range.bucketMs/60000}m • {normalized ? 'Normalized 0-100% per provider' : metric==='co2' ? 'Absolute kg CO₂' : 'Cost USD'} {smooth && '• Smoothed (w=3)'}
                    </Typography>
                    {hoverPoint && (
                      <Box sx={{ position:'absolute', top:8, right:12, bgcolor:'background.paper', px:1, py:0.5, borderRadius:1, boxShadow:1, border:(theme)=>`1px solid ${theme.palette.divider}`, fontFamily:'monospace' }}>
                        <Typography variant="caption" sx={{ display:'block' }}>{hoverPoint.provider.toUpperCase()}</Typography>
                        <Typography variant="caption" sx={{ display:'block' }}>{new Date(hoverPoint.t).toLocaleTimeString([], {hour12:false})}</Typography>
                        <Typography variant="caption" sx={{ display:'block', fontWeight:600 }}>{metric==='co2' ? `${hoverPoint.v.toFixed(4)} kg` : `$${hoverPoint.v.toFixed(4)}`}</Typography>
                      </Box>
                    )}
                  </AnimatedPaper>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
