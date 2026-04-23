// src/pages/dashboard/AwsResources.jsx
// Enhanced UI wrapper for AWS resources (instances + summary + filters) without changing existing data logic
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Stack, Typography, Paper, Chip, IconButton, Tooltip, Divider,
  Grid, TextField, InputAdornment, MenuItem, Table, TableContainer, TableHead,
  TableRow, TableCell, TableBody, TablePagination, CircularProgress, LinearProgress,
  ToggleButtonGroup, ToggleButton, Avatar, Fade
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import MemoryIcon from '@mui/icons-material/Memory';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import apiClient from '../../services/api/apiClient';
import { connectSocket } from '../../services/realtime/socketClient';
import { colors } from '../../styles/theme/colors';
import MetricCard from '../../components/common/Cards/MetricCard';
import { useTheme, alpha } from '@mui/material/styles';

// NOTE: We reuse the same backend endpoint /cloud/aws/instances; we add client-side filters only.
export default function AwsResources() {
  // Data state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [pulse, setPulse] = useState(false);

  // UI filters (client side only – does NOT change backend functionality)
  const [search, setSearch] = useState('');
  const [instanceTypeFilter, setInstanceTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState('table');
  // Grid enhancement controls (reduced per request)
  const [cpuBand, setCpuBand] = useState('all'); // all | low | mid | high

  const fetchInstances = async (newPage = page, newLimit = rowsPerPage) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/cloud/aws/instances?page=${newPage + 1}&limit=${newLimit}`);
      if (res.data?.success) {
        setRows(res.data.data.instances || []);
        setTotal(res.data.data.totalInstances || 0);
        setLastUpdated(res.data.data.capturedAt || new Date().toISOString());
      }
    } catch (e) {
      console.error('Failed to fetch AWS instances:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstances(); /* initial */ }, []); // eslint-disable-line

  // Realtime subscription
  useEffect(() => {
    const sock = connectSocket(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
    function onConnect() { setRealtimeConnected(true); }
    function onDisconnect() { setRealtimeConnected(false); }
    async function onIngest(evt) {
      if (evt?.type === 'ingest') {
        setPulse(true); setTimeout(() => setPulse(false), 700);
        fetchInstances(page, rowsPerPage);
      }
    }
    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('cloud:aws:instances', onIngest);
    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('cloud:aws:instances', onIngest);
    };
  }, [page, rowsPerPage]);

  // Derived metrics
  const avgCPUOverall = useMemo(() => rows.length ? Math.round(rows.reduce((s,r)=> s + (r.avgCPU||0),0)/rows.length*10)/10 : 0, [rows]);
  const totalNetworkIn = useMemo(() => rows.reduce((s,r)=> s + (r.networkIn||0),0), [rows]);
  const totalNetworkOut = useMemo(() => rows.reduce((s,r)=> s + (r.networkOut||0),0), [rows]);

  // Filtered rows for table view
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (instanceTypeFilter && r.instanceType !== instanceTypeFilter) return false;
      return true;
    });
  }, [rows, search, instanceTypeFilter]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Unique instance types for dropdown
  const instanceTypes = useMemo(() => Array.from(new Set(rows.map(r => r.instanceType))).sort(), [rows]);

  const handleChangePage = (_e, p) => setPage(p);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value,10)); setPage(0); };

  // Helpers --------------------------------------------------
  const formatNumber = (n) => {
    if (n === undefined || n === null) return '-';
    if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n/1_000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatBytes = (n) => {
    if (n === undefined || n === null) return '-';
    if (n < 1024) return n + ' B';
    const units = ['KB','MB','GB','TB'];
    let v = n; let i = -1;
    do { v /= 1024; i++; } while (v >= 1024 && i < units.length-1);
    return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2) + ' ' + units[i];
  };

  const cpuSeverity = (cpu) => {
    if (cpu >= 75) return { color: '#ff1744', bg: 'linear-gradient(135deg,#ff8a80,#ff5252)', ring: '#ff1744' };
    if (cpu >= 45) return { color: '#ff9100', bg: 'linear-gradient(135deg,#ffd180,#ffab40)', ring: '#ff9100' };
    return { color: '#00bfa5', bg: 'linear-gradient(135deg,#64ffda,#1de9b6)', ring: '#00bfa5' };
  };

  const cardShadow = (ring) => `0 3px 10px -2px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04), 0 0 0 2px ${ring}40`;

  return (
    <Box>
      <Stack direction={{ xs:'column', md:'row' }} spacing={2} alignItems={{ md:'center' }} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CloudQueueIcon color="primary" fontSize="large" />
          <Typography variant="h5" fontWeight={700}>AWS Resources</Typography>
          {realtimeConnected && <Chip size="small" color="success" label="Realtime" />}
          {pulse && <Chip size="small" color="info" label="Updated" />}
        </Stack>
        <Box flexGrow={1} />
        <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_e,v)=> v && setViewMode(v)}>
          <ToggleButton value="table">Table</ToggleButton>
          <ToggleButton value="grid">Grid</ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title="Refresh">
          <IconButton onClick={() => fetchInstances()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Instances"
            value={total}
            subtitle="Active EC2"
            icon={CloudQueueIcon}
            color={colors.providers.aws.main}
            variant="gradient"
            progress={Math.min(100, total * 5)}
            progressLabel="Capacity scale"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average CPU"
            value={avgCPUOverall}
            unit="%"
            subtitle="Realtime avg"
            icon={MemoryIcon}
            color={colors.primary[500]}
            variant="gradient"
            progress={Math.min(100, avgCPUOverall)}
            progressLabel="Utilization"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Network In"
            value={totalNetworkIn}
            subtitle="Bytes received"
            icon={SouthIcon}
            color={colors.providers.azure.main}
            variant="gradient"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Network Out"
            value={totalNetworkOut}
            subtitle="Bytes sent"
            icon={NorthIcon}
            color={colors.providers.gcp.main}
            variant="gradient"
          />
        </Grid>
      </Grid>

  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField
            size="small"
            label="Search Instance ID"
            value={search}
            onChange={(e)=>{ setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
            sx={{ width: { xs:'100%', md: 260 } }}
          />
          <TextField
            size="small"
            select
            label="Instance Type"
            value={instanceTypeFilter}
            onChange={(e)=>{ setInstanceTypeFilter(e.target.value); setPage(0); }}
            sx={{ width: { xs:'100%', md: 200 } }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><FilterAltIcon fontSize="small" /></InputAdornment>) }}
          >
            <MenuItem value="">All</MenuItem>
            {instanceTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Box flexGrow={1} />
          <Typography variant="caption" color="text.secondary">Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}</Typography>
        </Stack>
      </Paper>

      {viewMode === 'grid' ? (
        <Box>
          {/* Grid toolbar */}
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} flexWrap="wrap">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: .5 }}>CPU Filter</Typography>
                {['all','low','mid','high'].map(b => {
                  const labelMap = { all: 'All', low: '<45%', mid: '45-75%', high: '75%+' };
                  const active = cpuBand === b;
                  return (
                    <Chip
                      key={b}
                      label={labelMap[b]}
                      size="small"
                      color={active ? (b==='high'?'error': b==='mid'?'warning': b==='low'?'success':'primary') : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => setCpuBand(b)}
                      sx={{ fontWeight: 600, borderRadius: 2 }}
                    />
                  );
                })}
              </Stack>
              <Box flexGrow={1} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>{filtered.length} filtered • {rows.length} total</Typography>
            </Stack>
          </Paper>

          {/* Compute grid set */}
          <Grid container spacing={2}>
            {loading ? (
              <Grid item xs={12}><Box textAlign="center" py={6}><CircularProgress /><Typography mt={2} variant="body2">Loading...</Typography></Box></Grid>
            ) : (
              (() => {
                // Apply cpu band filter
                let base = [...filtered];
                base = base.filter(r => {
                  const c = r.avgCPU || 0;
                  if (cpuBand === 'low') return c < 45;
                  if (cpuBand === 'mid') return c >=45 && c < 75;
                  if (cpuBand === 'high') return c >= 75;
                  return true;
                });
                // Paginate using same page/rowsPerPage but on base (no custom sort)
                const start = page * rowsPerPage;
                const view = base.slice(start, start + rowsPerPage);
                if (!view.length) return <Grid item xs={12}><Typography variant="body2" color="text.secondary">No instances match filters.</Typography></Grid>;
                return view.map(r => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={r.id}>
                    <Fade in timeout={400}>
                      <InstanceCard r={r} cpuSeverity={cpuSeverity} formatBytes={formatBytes} />
                    </Fade>
                  </Grid>
                ));
              })()
            )}
          </Grid>
        </Box>
      ) : (
        <Paper variant="outlined">
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Instance ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Avg CPU %</TableCell>
                  <TableCell align="right">Net In</TableCell>
                  <TableCell align="right">Net Out</TableCell>
                  <TableCell align="right">Disk Read</TableCell>
                  <TableCell align="right">Disk Write</TableCell>
                  <TableCell align="right">Samples</TableCell>
                  <TableCell>Region</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}><CircularProgress /><Typography mt={2} variant="body2">Loading...</Typography></TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><Typography variant="body2" color="text.secondary">No instances match filters.</Typography></TableCell></TableRow>
                ) : (
                  paginated.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>{r.instanceType}</TableCell>
                      <TableCell align="right">{r.avgCPU}</TableCell>
                      <TableCell align="right">{r.networkIn}</TableCell>
                      <TableCell align="right">{r.networkOut}</TableCell>
                      <TableCell align="right">{r.diskRead}</TableCell>
                      <TableCell align="right">{r.diskWrite}</TableCell>
                      <TableCell align="right">{r.sampleCount}</TableCell>
                      <TableCell>{r.region}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5,10,20,50]}
            labelRowsPerPage="Rows"
          />
        </Paper>
      )}
    </Box>
  );
}

// Reusable statistic line component for the grid cards
function Stat({ label, value, inline }) {
  return (
    <Stack direction={inline ? 'row' : 'column'} spacing={0.2} alignItems={inline ? 'center' : 'flex-start'}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

// InstanceCard - forwardRef for MUI Transition compatibility (simplified, improved color aesthetics)
const InstanceCard = React.forwardRef(function InstanceCard({ r, cpuSeverity, formatBytes }, ref) {
  const theme = useTheme();
  const sev = cpuSeverity(r.avgCPU || 0);
  const size = 68; // larger gauge
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, r.avgCPU || 0);
  const dash = (pct / 100) * circ;
  // Severity driven aesthetics (light & dark variants)
  const palette = (() => {
    const mode = theme.palette.mode;
    const cpu = pct;
    if (mode === 'light') {
      if (cpu >= 75) return {
        bg: `linear-gradient(135deg, ${alpha(sev.ring,0.12)} 0%, ${alpha(sev.ring,0.04)} 100%)`,
        ring: sev.ring,
        glow: alpha(sev.ring,0.28),
        panel: alpha(sev.ring,0.10),
        border: alpha(sev.ring,0.35),
        textMain: theme.palette.text.primary
      };
      if (cpu >= 45) return {
        bg: `linear-gradient(135deg, ${alpha(sev.ring,0.14)} 0%, ${alpha(sev.ring,0.05)} 100%)`,
        ring: sev.ring,
        glow: alpha(sev.ring,0.25),
        panel: alpha(sev.ring,0.12),
        border: alpha(sev.ring,0.32),
        textMain: theme.palette.text.primary
      };
      return {
        bg: `linear-gradient(135deg, ${alpha(sev.ring,0.16)} 0%, ${alpha(sev.ring,0.05)} 100%)`,
        ring: sev.ring,
        glow: alpha(sev.ring,0.20),
        panel: alpha(sev.ring,0.10),
        border: alpha(sev.ring,0.30),
        textMain: theme.palette.text.primary
      };
    } else { // dark
      if (cpu >= 75) return {
        bg: 'linear-gradient(145deg,#311112,#190707)',
        ring: sev.ring,
        glow: sev.ring + '80',
        panel: '#3c1c1e',
        border: '#552224',
        textMain: '#ffffff'
      };
      if (cpu >= 45) return {
        bg: 'linear-gradient(145deg,#2e2312,#181007)',
        ring: sev.ring,
        glow: sev.ring + '70',
        panel: '#3a2d16',
        border: '#54401f',
        textMain: '#ffffff'
      };
      return {
        bg: 'linear-gradient(145deg,#0f271f,#091612)',
        ring: sev.ring,
        glow: sev.ring + '70',
        panel: '#12342a',
        border: '#1e473a',
        textMain: '#ffffff'
      };
    }
  })();
  return (
    <Paper
      ref={ref}
      elevation={0}
      sx={{
        position: 'relative',
        p: 2.2,
        borderRadius: 5,
        overflow: 'hidden',
        minHeight: 210,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        '&:before': {
          content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 78% 18%, ${palette.ring}33, transparent 75%)`
        },
        transition: 'transform .25s, box-shadow .25s, border-color .25s',
        boxShadow: `0 6px 22px -8px ${palette.glow}, 0 2px 4px -1px #000`,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 14px 42px -12px ${palette.glow}, 0 0 0 1px ${palette.ring}55` ,
          borderColor: palette.ring + 'AA'
        }
      }}
    >
      <Stack direction="row" spacing={1.8} alignItems="center" mb={1.3}>
        <Box sx={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={size/2} cy={size/2} r={radius} stroke={palette.panel} strokeWidth={stroke} fill={palette.panel} />
            <circle
              cx={size/2}
              cy={size/2}
              r={radius}
              stroke={palette.ring}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${circ-dash}`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray .6s ease' }}
            />
          </svg>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ fontSize: '.7rem', fontWeight: 800, color: palette.ring }}>{pct.toFixed(0)}%</Typography>
            <Typography variant="caption" sx={{ fontSize: '.5rem', letterSpacing: .5, color: 'text.secondary' }}>CPU</Typography>
          </Box>
        </Box>
        <Box flexGrow={1} minWidth={0}>
          <Tooltip title={r.id} placement="top" arrow>
            <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontSize: '.85rem', letterSpacing: .35 }}>{r.id}</Typography>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '.64rem', fontWeight:700, letterSpacing:.45 }}>{r.instanceType} • {r.region}</Typography>
        </Box>
        <Chip size="small" label={r.sampleCount} sx={{ bgcolor: palette.panel, color: 'text.secondary', fontWeight:800, letterSpacing:.4 }} />
      </Stack>
      <Grid container spacing={1} sx={{ mt: 'auto' }}>
        <Grid item xs={6}><Mini label="NET IN" value={formatBytes(r.networkIn)} palette={palette} /></Grid>
        <Grid item xs={6}><Mini label="NET OUT" value={formatBytes(r.networkOut)} palette={palette} /></Grid>
        <Grid item xs={6}><Mini label="DISK R" value={formatBytes(r.diskRead)} palette={palette} /></Grid>
        <Grid item xs={6}><Mini label="DISK W" value={formatBytes(r.diskWrite)} palette={palette} /></Grid>
        <Grid item xs={12}><Mini label="SAMPLES" value={r.sampleCount} full palette={palette} /></Grid>
      </Grid>
    </Paper>
  );
});

function Mini({ label, value, full, palette }) {
  return (
    <Stack direction={full ? 'row':'column'} spacing={0.35} alignItems={full ? 'center':'flex-start'} justifyContent={full ? 'space-between':'flex-start'} sx={{
      background: palette ? palette.panel : '#161d22',
      px: 1.1,
      py: 0.7,
      borderRadius: 1.4,
      border: `1px solid ${palette ? palette.border : '#1f272e'}`,
      boxShadow: palette ? `0 0 0 1px ${palette.ring}12 inset` : 'none'
    }}>
  <Typography variant="caption" sx={{ fontSize: '0.55rem', letterSpacing: .8, color: 'text.secondary', fontWeight:800 }}>{label}</Typography>
  <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 800 }}>{value}</Typography>
    </Stack>
  );
}
