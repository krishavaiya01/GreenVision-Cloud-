import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Grid, Paper, Typography, alpha, useTheme, Chip, Stack, Divider,
  Slider, Button, IconButton, Tooltip, LinearProgress, Skeleton, ToggleButtonGroup,
  ToggleButton, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  TextField
} from '@mui/material';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import { cloudApi } from '../../services/api/cloudApi';
import { carbonRealtimeApi } from '../../services/api/carbonRealtimeApi';
import { motion } from 'framer-motion';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import ForestIcon from '@mui/icons-material/Forest';
import LayersIcon from '@mui/icons-material/Layers';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import PaidIcon from '@mui/icons-material/Paid';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-hot-toast';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneAllIcon from '@mui/icons-material/DoneAll';

// Simple count-up hook (reuse logic style from CarbonTracking)
function useCountUp(target, duration = 1200, deps = []) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null || isNaN(target)) return;
    let start = 0;
    const d = Math.max(duration, 200);
    const t0 = performance.now();
    let raf;
    const step = (ts) => {
      const p = Math.min(1, (ts - t0) / d);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.concat([target]));
  return val;
}

// Simulated marketplace projects (would come from backend in future)
const PROJECTS = [
  { id: 'proj-forest-br', name: 'Amazon Reforestation', type: 'Reforestation', region: 'Brazil', price: 14.5, quality: 87, removal: true },
  { id: 'proj-dac-us', name: 'Direct Air Capture Pilot', type: 'DAC', region: 'USA', price: 320, quality: 94, removal: true },
  { id: 'proj-wind-in', name: 'Wind Power Expansion', type: 'Renewable', region: 'India', price: 8.9, quality: 72, removal: false },
  { id: 'proj-mangrove-ke', name: 'Mangrove Restoration', type: 'Blue Carbon', region: 'Kenya', price: 22, quality: 90, removal: true },
  { id: 'proj-biochar-se', name: 'Biochar Soil Carbon', type: 'Biochar', region: 'Sweden', price: 65, quality: 88, removal: true },
  { id: 'proj-landfill-de', name: 'Landfill Gas Capture', type: 'Methane', region: 'Germany', price: 11, quality: 69, removal: false },
];

export default function CarbonOffsets() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [footprint, setFootprint] = useState(null); // aggregated footprint data
  const [realtime, setRealtime] = useState(null);
  const [scenarioPct, setScenarioPct] = useState(50);
  const [mode, setMode] = useState('neutral'); // neutral | netzero | sfti (science-based)
  const [projectFilter, setProjectFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [tonsOverride, setTonsOverride] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [ledger, setLedger] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('offsetLedger')||'[]'); } catch { return []; }
  });

  // Persist ledger
  useEffect(()=>{ try { localStorage.setItem('offsetLedger', JSON.stringify(ledger)); } catch {} }, [ledger]);

  // Fetch footprint & realtime
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [fpRes, rtRes] = await Promise.all([
          cloudApi.getCarbonFootprint(),
          carbonRealtimeApi.getRealtime({ sinceMinutes: 30 })
        ]);
        if (!mounted) return;
        setFootprint(fpRes?.data || fpRes); // API pattern sometimes wraps in data
        setRealtime(rtRes);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load carbon data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Monthly snapshot emissions (kg CO2) from backend: field name totalEmissions
  const monthlyEmissionsKg = footprint?.totalEmissions || 0;

  // Realtime window emissions (kg CO2) from last 30 mins (augment context)
  const realtimeKg = realtime?.totals?.kgCO2 || 0;

  // Combined displayed emissions (monthly + current window) -> tons
  const totalEmissionsTons = useMemo(()=> (monthlyEmissionsKg + realtimeKg) / 1000, [monthlyEmissionsKg, realtimeKg]);

  const recommendedTons = useMemo(() => {
    if (!totalEmissionsTons) return 0;
    let base = totalEmissionsTons; // full coverage
    if (mode === 'neutral') base = totalEmissionsTons; // 100%
    else if (mode === 'netzero') base = totalEmissionsTons * 1.05; // overshoot to plan for residuals
    else if (mode === 'sfti') base = totalEmissionsTons * 0.9; // science pathway partial immediate coverage
    const scenario = (scenarioPct / 100) * base;
    if (tonsOverride) {
      const v = parseFloat(tonsOverride);
      if (!isNaN(v)) return v;
    }
    return scenario;
  }, [totalEmissionsTons, mode, scenarioPct, tonsOverride]);

  const avgPrice = useMemo(() => {
    if (!selected.length) return 0;
    const sel = PROJECTS.filter(p => selected.includes(p.id));
    return sel.reduce((s, p) => s + p.price, 0) / sel.length;
  }, [selected]);

  const estCost = useMemo(() => recommendedTons * avgPrice, [recommendedTons, avgPrice]);

  const providerBreakdown = useMemo(() => {
    // Prefer monthly provider snapshot if exists; else derive from realtime providers
    if (footprint?.providers) {
      const arr = Object.entries(footprint.providers).map(([prov, val]) => ({ provider: prov, kg: val.co2Kg || val.co2 || val.totalEmissions || 0 }));
      const sum = arr.reduce((s,r)=> s + r.kg, 0) || 1;
      return arr.map(r => ({ ...r, pct: r.kg / sum }));
    }
    if (realtime?.providers?.length) {
      const arr = realtime.providers.map(p => ({ provider: p.provider, kg: p.kgCO2 }));
      const sum = arr.reduce((s,r)=> s + r.kg, 0) || 1;
      return arr.map(r => ({ ...r, pct: r.kg / sum }));
    }
    return [];
  }, [footprint, realtime]);

  // Simulated coverage and residual (will later use retired offsets ledger)
  const retiredTons = useMemo(()=> ledger.filter(l=> l.status==='retired').reduce((s,l)=> s + l.tons,0), [ledger]);
  const heldTons = useMemo(()=> ledger.filter(l=> l.status==='held').reduce((s,l)=> s + l.tons,0), [ledger]);
  const coveragePct = useMemo(()=> totalEmissionsTons ? (retiredTons/ totalEmissionsTons)*100 : 0, [retiredTons, totalEmissionsTons]);
  const residualTons = useMemo(()=> Math.max(0, totalEmissionsTons - retiredTons), [totalEmissionsTons, retiredTons]);

  const filteredProjects = PROJECTS.filter(p => projectFilter === 'all' || p.type.toLowerCase() === projectFilter);

  const kpiVariants = { hidden: { opacity: 0, y: 16 }, show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.55, ease: 'easeOut' } }) };

  const glass = (o=0.14) => ({
    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, o)} 0%, ${alpha(theme.palette.secondary?.main || theme.palette.success.main, o*0.85)} 100%)`,
    border: `1px solid ${alpha(theme.palette.divider,0.4)}`,
    backdropFilter: 'blur(14px)'
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const rt = await carbonRealtimeApi.getRealtime({ sinceMinutes: 30 });
      setRealtime(rt);
      toast.success('Realtime updated');
    } catch(err) { toast.error('Refresh failed'); }
    setRefreshing(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const commitScenario = () => {
    if (!recommendedTons || !selected.length) {
      toast.error('Select at least one project');
      return;
    }
    const perProject = recommendedTons / selected.length;
    const lots = selected.map(id => {
      const proj = PROJECTS.find(p=>p.id===id);
      return { id: 'lot-'+Date.now()+'-'+id, projectId: id, name: proj?.name || id, tons: Number(perProject.toFixed(3)), price: proj?.price||0, status:'held', createdAt: Date.now() };
    });
    setLedger(prev=> [...prev, ...lots]);
    toast.success('Scenario allocated');
  };

  const retireLot = (lotId) => {
    setLedger(prev=> prev.map(l=> l.id===lotId ? { ...l, status:'retired', retiredAt: Date.now() } : l));
    toast.success('Lot retired');
  };

  const deleteLot = (lotId) => {
    setLedger(prev=> prev.filter(l=> l.id!==lotId));
    toast('Lot removed');
  };

  // Anim vals
  const animEmissions = useCountUp(totalEmissionsTons, 1200, [totalEmissionsTons]);
  const animRecommended = useCountUp(recommendedTons, 1200, [recommendedTons]);
  const animCoverage = useCountUp(coveragePct, 1200, [coveragePct]);
  const animResidual = useCountUp(residualTons, 1200, [residualTons]);

  return (
    <DashboardLayout title="Carbon Offsets">
      <Box sx={{ display:'flex', flexDirection:'column', gap:4, pb:8 }}>
        {/* KPI Row */}
        <Grid container spacing={2}>
          {[
            { label: 'Total Emissions (tCO₂e)', val: animEmissions, icon: <SpeedIcon />, fmt: v => v.toFixed(2) },
            { label: 'Residual (t)', val: animResidual, icon: <ShowChartIcon />, fmt: v => v.toFixed(2) },
            { label: 'Recommended Offsets (t)', val: animRecommended, icon: <ForestIcon />, fmt: v => v.toFixed(2) },
            { label: 'Coverage %', val: animCoverage, icon: <ShowChartIcon />, fmt: v => v.toFixed(1)+'%' },
          ].map((k,i)=>(
            <Grid item xs={12} sm={6} md={3} key={k.label}>
              <Paper component={motion.div} custom={i} initial="hidden" animate="show" variants={kpiVariants}
                sx={{ p:2.5, borderRadius:3, display:'flex', flexDirection:'column', gap:0.5, ...glass(0.18), position:'relative', overflow:'hidden' }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                  <Box sx={{ width:38, height:38, borderRadius:2, display:'flex', alignItems:'center', justifyContent:'center', background:alpha(theme.palette.primary.main,0.15) }}>{k.icon}</Box>
                  <Typography variant="caption" sx={{ fontWeight:600, letterSpacing:0.5, opacity:0.75 }}>{k.label}</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700}>{k.fmt(k.val)}</Typography>
                {k.label==='Total Emissions (tCO₂e)' && !!realtimeKg && (
                  <Chip size="small" color="info" label={`+${(realtimeKg/1000).toFixed(3)} t last 30m`} sx={{ alignSelf:'flex-start', mt:0.5 }} />
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* Provider Breakdown */}
            <Grid item xs={12} md={5}>
              <Paper sx={{ p:3, borderRadius:3, ...glass(0.16), height:'100%', display:'flex', flexDirection:'column' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <LayersIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>Provider Breakdown</Typography>
                  <Tooltip title="Distribution of current aggregated emissions by provider."><InfoOutlinedIcon fontSize="small" sx={{ opacity:0.6 }} /></Tooltip>
                </Stack>
                <Divider sx={{ mb:2 }} />
                <Box sx={{ display:'flex', flexDirection:'column', gap:1.5 }}>
                  {loading && [...Array(4)].map((_,i)=> <Skeleton key={i} variant="rounded" height={32} />)}
                  {!loading && providerBreakdown.length === 0 && <Typography variant="body2" sx={{ opacity:0.6 }}>No provider data.</Typography>}
                  {!loading && providerBreakdown.map(p => (
                    <Box key={p.provider}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography fontWeight={600} variant="caption">{p.provider.toUpperCase()}</Typography>
                        <Typography variant="caption" sx={{ opacity:0.7 }}>{(p.pct*100).toFixed(1)}%</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={p.pct*100} sx={{ height:10, borderRadius:5, background:alpha(theme.palette.text.primary,0.1), '& .MuiLinearProgress-bar': { borderRadius:5 } }} />
                    </Box>
                  ))}
                </Box>
                {/* Detailed realtime metrics table */}
                {realtime?.providers?.length ? (
                  <Box mt={3}>
                    <Typography variant="caption" fontWeight={600} sx={{ opacity:0.7 }}>Realtime Provider Metrics</Typography>
                    <Box mt={1} sx={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight:600 }}>Prov</Typography>
                      <Typography variant="caption" sx={{ fontWeight:600 }}>kgCO₂</Typography>
                      <Typography variant="caption" sx={{ fontWeight:600 }}>kWh</Typography>
                      <Typography variant="caption" sx={{ fontWeight:600 }}>Cost</Typography>
                      <Typography variant="caption" sx={{ fontWeight:600 }}>kg/GB</Typography>
                      {realtime.providers.map(r => (
                        <React.Fragment key={r.provider}>
                          <Typography variant="caption">{r.provider}</Typography>
                          <Typography variant="caption">{r.kgCO2.toFixed(3)}</Typography>
                          <Typography variant="caption">{r.kWh.toFixed(2)}</Typography>
                          <Typography variant="caption">${r.cost.toFixed(2)}</Typography>
                          <Typography variant="caption">{r.intensity.kgPerGB.toFixed(3)}</Typography>
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                ): null}
              </Paper>
            </Grid>

            {/* Scenario Planner */}
            <Grid item xs={12} md={7}>
              <Paper sx={{ p:3, borderRadius:3, ...glass(0.16), height:'100%', display:'flex', flexDirection:'column' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <TimelineIcon color="secondary" />
                  <Typography variant="h6" fontWeight={600}>Offset Scenario Planner</Typography>
                </Stack>
                <Divider sx={{ mb:2 }} />
                <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap">
                  <ToggleButtonGroup exclusive size="small" value={mode} onChange={(e,v)=> v && setMode(v)}>
                    <ToggleButton value="neutral">Neutral</ToggleButton>
                    <ToggleButton value="sfti">Science Path</ToggleButton>
                    <ToggleButton value="netzero">Net Zero</ToggleButton>
                  </ToggleButtonGroup>
                  <Chip label={`Scenario: ${scenarioPct}%`} />
                  <Tooltip title="Refresh realtime support data"><span><IconButton disabled={refreshing} onClick={handleRefresh}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip>
                </Stack>
                <Box px={1}>
                  <Slider value={scenarioPct} onChange={(_,v)=>setScenarioPct(v)} valueLabelDisplay="auto" />
                </Box>
                <Stack direction="row" gap={2} mt={1} flexWrap="wrap">
                  <TextField size="small" label="Override Tons" value={tonsOverride} onChange={e=>setTonsOverride(e.target.value)} sx={{ maxWidth:160 }} />
                  <Chip color="info" label={`Recommended: ${recommendedTons.toFixed(2)} t`} />
                  <Chip color="success" label={`Est. Cost: ${estCost ? '$'+estCost.toFixed(2) : '—'}`} />
                </Stack>
                <Box mt={3}>
                  <Typography variant="caption" sx={{ opacity:0.7 }}>Select projects below to allocate scenario.</Typography>
                </Box>
                <Box mt="auto" pt={3}>
                  <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={commitScenario} disabled={!selected.length || !recommendedTons}>Apply Scenario (Sim)</Button>
                </Box>
              </Paper>
            </Grid>
        </Grid>

        {/* Marketplace & Ledger */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p:3, borderRadius:3, ...glass(0.16), display:'flex', flexDirection:'column', gap:2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoAwesomeIcon color="warning" />
                <Typography variant="h6" fontWeight={600}>Project Marketplace</Typography>
                <ToggleButtonGroup size="small" exclusive value={projectFilter} onChange={(e,v)=> v && setProjectFilter(v)} sx={{ ml:'auto' }}>
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="reforestation">Reforest</ToggleButton>
                  <ToggleButton value="dac">DAC</ToggleButton>
                  <ToggleButton value="renewable">Renewable</ToggleButton>
                  <ToggleButton value="biochar">Biochar</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Divider />
              <Grid container spacing={2}>
                {loading && [...Array(6)].map((_,i)=> (
                  <Grid key={i} item xs={12} sm={6} md={4}><Skeleton variant="rounded" height={120} /></Grid>
                ))}
                {!loading && filteredProjects.map(p => {
                  const active = selected.includes(p.id);
                  return (
                    <Grid key={p.id} item xs={12} sm={6} md={4}>
                      <Paper component={motion.div} whileHover={{ y:-6 }} whileTap={{ scale:0.98 }} onClick={()=>toggleSelect(p.id)}
                        sx={{ p:2, cursor:'pointer', borderRadius:3, position:'relative', overflow:'hidden', ...glass(active?0.25:0.12), outline: active? `2px solid ${theme.palette.success.main}` : 'none', display:'flex', flexDirection:'column', gap:0.5 }}>
                        <Typography fontWeight={600} variant="subtitle2" noWrap>{p.name}</Typography>
                        <Typography variant="caption" sx={{ opacity:0.65 }}>{p.type} • {p.region}</Typography>
                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                          <Chip size="small" label={`$${p.price}/t`} />
                          <Chip size="small" color={p.removal? 'success':'default'} label={p.removal? 'Removal':'Avoidance'} />
                          <Chip size="small" color={p.quality>85? 'success': p.quality>75? 'info':'default'} label={`Q${p.quality}`} />
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p:3, borderRadius:3, ...glass(0.16), display:'flex', flexDirection:'column', height:'100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <ScatterPlotIcon color="info" />
                <Typography variant="h6" fontWeight={600}>Offset Ledger (Sim)</Typography>
              </Stack>
              <Divider sx={{ mb:2 }} />
              <TableContainer sx={{ flex:1, maxHeight:300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Project</TableCell>
                      <TableCell align="right">Tons</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledger.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="caption" sx={{ opacity:0.6 }}>No lots yet. Allocate a scenario.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {ledger.map(lot => (
                      <TableRow key={lot.id} hover>
                        <TableCell><Typography variant="caption" fontWeight={600}>{lot.name}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="caption">{lot.tons.toFixed(3)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="caption">${(lot.price * lot.tons).toFixed(2)}</Typography></TableCell>
                        <TableCell align="right"><Chip size="small" color={lot.status==='retired' ? 'success' : 'default'} label={lot.status} /></TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {lot.status==='held' && <Tooltip title="Retire"><IconButton size="small" onClick={()=>retireLot(lot.id)}><DoneAllIcon fontSize="inherit" /></IconButton></Tooltip>}
                            <Tooltip title="Remove"><IconButton size="small" onClick={()=>deleteLot(lot.id)}><DeleteIcon fontSize="inherit" /></IconButton></Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" spacing={1} mt={2}>
                <Chip size="small" label={`Held: ${heldTons.toFixed(2)} t`} />
                <Chip size="small" color="success" label={`Retired: ${retiredTons.toFixed(2)} t`} />
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}
