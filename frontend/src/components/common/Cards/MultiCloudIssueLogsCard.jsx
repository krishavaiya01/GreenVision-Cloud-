import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cloudLogsApi } from '../../../services/api/cloudLogsApi';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  LinearProgress,
  alpha,
  useTheme,
  Divider,
  Skeleton,
  Stack,
  Menu,
  MenuItem
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
// LayersIcon removed with advanced filters
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import GetAppIcon from '@mui/icons-material/GetApp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ViewListIcon from '@mui/icons-material/ViewList';
import { motion } from 'framer-motion';

const providerOptions = ['all','aws','azure','gcp'];
const timePresets = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '24h', minutes: 1440 }
];
const limitOptions = [50,100,200,500];
const refreshOptions = [15,30,45,60];

export default function MultiCloudIssueLogsCard({ sinceMinutes = 60, limit = 100, refreshSec = 30 }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [provider, setProvider] = useState('all');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextRefresh, setNextRefresh] = useState(refreshSec);
  const [currentSinceMinutes, setCurrentSinceMinutes] = useState(sinceMinutes);
  const [currentLimit, setCurrentLimit] = useState(limit);
  const [currentRefresh, setCurrentRefresh] = useState(refreshSec);
  const [paused, setPaused] = useState(false);
  const [anchorLimit, setAnchorLimit] = useState(null);
  const [anchorRefresh, setAnchorRefresh] = useState(null);
  const [anchorTime, setAnchorTime] = useState(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Load persisted filters once
  useEffect(() => {
    const saved = localStorage.getItem('mcLogsFilters');
    if (!saved) return;
    try {
      const obj = JSON.parse(saved);
      if (obj.provider) setProvider(obj.provider);
      if (typeof obj.level === 'string') setLevel(obj.level);
      if (obj.since) setCurrentSinceMinutes(obj.since);
      if (obj.limit) setCurrentLimit(obj.limit);
      if (obj.refresh) setCurrentRefresh(obj.refresh);
    } catch(_){}
  }, []);

  // Persist on change
  useEffect(() => {
    const state = { provider, level, since: currentSinceMinutes, limit: currentLimit, refresh: currentRefresh };
    localStorage.setItem('mcLogsFilters', JSON.stringify(state));
  }, [provider, level, currentSinceMinutes, currentLimit, currentRefresh]);

  // Fetch logs
  const fetchLogs = async (manual = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await cloudLogsApi.getIssueLogs({ provider, level: level || undefined, sinceMinutes: currentSinceMinutes, limit: currentLimit });
      setLogs(data || []);
      if (manual) setNextRefresh(currentRefresh);
    } catch (e) {
      setError(e?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh
  useEffect(() => {
    fetchLogs();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!paused) {
      intervalRef.current = setInterval(() => fetchLogs(), currentRefresh * 1000);
    }
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [provider, level, currentSinceMinutes, currentLimit, currentRefresh, paused]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setNextRefresh(currentRefresh);
    if (!paused) {
      countdownRef.current = setInterval(() => {
        setNextRefresh(prev => prev <= 1 ? currentRefresh : prev - 1);
      }, 1000);
    }
    return () => countdownRef.current && clearInterval(countdownRef.current);
  }, [provider, level, currentRefresh, paused]);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return (logs || []).filter(l => {
      if (!lower) return true;
      return (
        l.message?.toLowerCase().includes(lower) ||
        l.logGroup?.toLowerCase().includes(lower) ||
        l.logStream?.toLowerCase().includes(lower)
      );
    }).slice(0, currentLimit);
  }, [logs, search, currentLimit]);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  const handleCopy = (log) => {
    const text = `[${(log.provider||'aws').toUpperCase()}] ${log.level?.toUpperCase()} ${log.logGroup}${log.logStream?' / '+log.logStream:''} :: ${log.message}`;
    navigator.clipboard.writeText(text).catch(()=>{});
  };

  const resetFilters = () => {
    setProvider('all');
    setLevel('');
    setSearch('');
    setCurrentSinceMinutes(60);
    setCurrentLimit(100);
    setCurrentRefresh(30);
  };

  const openMenu = (setter) => (e) => setter(e.currentTarget);
  const closeMenu = (setter) => () => setter(null);
  const applyTime = (m) => { setCurrentSinceMinutes(m); setAnchorTime(null); };
  const applyLimit = (l) => { setCurrentLimit(l); setAnchorLimit(null); };
  const applyRefresh = (r) => { setCurrentRefresh(r); setAnchorRefresh(null); setNextRefresh(r); };
  const togglePause = () => setPaused(p => !p);
  const clearSearch = () => setSearch('');
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    a.download = `issue-logs-${provider}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper elevation={0} sx={{
      p: 2.5,
      borderRadius: 4,
      position: 'relative',
      background: isDark
        ? 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.035) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,245,245,0.7) 100%)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.08)}`,
      overflow: 'hidden'
    }}>
      {loading && (
        <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}
      {/* Header & Summary */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1, letterSpacing: '.5px' }}>
          Multi‑Cloud Issue Logs
        </Typography>
        <Chip size="small" color={errorCount>0? 'error':'default'} icon={<ErrorOutlineIcon />} label={`${errorCount} Errors`} variant={errorCount? 'filled':'outlined'} sx={{ fontWeight: 600 }} />
        <Chip size="small" color={warnCount>0? 'warning':'default'} icon={<WarningAmberIcon />} label={`${warnCount} Warnings`} variant={warnCount? 'filled':'outlined'} sx={{ fontWeight: 600 }} />
        <Chip size="small" variant="outlined" label={paused ? 'PAUSED' : `${nextRefresh}s`} sx={{ fontWeight: 600 }} />
        <Tooltip title={paused ? 'Resume auto refresh' : 'Pause auto refresh'}>
          <IconButton size="small" onClick={togglePause}>
            {paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Export visible logs (JSON)">
          <span>
            <IconButton size="small" onClick={exportJson} disabled={filtered.length === 0}>
              <GetAppIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reset filters">
          <span>
            <IconButton size="small" onClick={resetFilters}>
              <FilterAltOffIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Manual refresh">
          <span>
            <IconButton size="small" disabled={loading} onClick={() => fetchLogs(true)}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Primary Filters (pills) */}
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
        {providerOptions.map(p => {
          const active = provider === p;
          const paletteColor = p === 'aws' ? theme.palette.success.main : p === 'azure' ? theme.palette.info.main : p === 'gcp' ? theme.palette.secondary.main : theme.palette.primary.main;
          const disabled = p !== 'aws' && p !== 'all';
          return (
            <Tooltip key={p} title={disabled ? `${p.toUpperCase()} data not yet available` : ''} disableHoverListener={!disabled}>
              <Chip
              key={p}
              label={p.toUpperCase()}
              size="small"
              onClick={() => !disabled && setProvider(p)}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '.5px',
                bgcolor: active ? alpha(paletteColor, 0.25) : alpha(paletteColor, 0.08),
                color: active ? paletteColor : alpha(paletteColor, 0.9),
                border: `1px solid ${alpha(paletteColor, active ? 0.55 : 0.3)}`,
                opacity: disabled ? 0.45 : 1,
                '&:hover': { bgcolor: disabled ? undefined : alpha(paletteColor, 0.35) }
              }}
            />
            </Tooltip>
          );
        })}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, opacity: 0.3 }} />
        {['', 'error', 'warn'].map(lvl => {
          const active = level === lvl;
          const label = lvl === '' ? 'ALL LEVELS' : lvl.toUpperCase();
          const paletteColor = lvl === 'error' ? theme.palette.error.main : lvl === 'warn' ? theme.palette.warning.main : theme.palette.text.primary;
          return (
            <Chip
              key={lvl || 'all-levels'}
              label={label}
              size="small"
              onClick={() => setLevel(lvl)}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                bgcolor: active ? alpha(paletteColor, 0.25) : alpha(paletteColor, 0.07),
                color: active ? paletteColor : alpha(paletteColor, 0.85),
                border: `1px solid ${alpha(paletteColor, active ? 0.5 : 0.25)}`,
                '&:hover': { bgcolor: alpha(paletteColor, 0.32) }
              }}
            />
          );
        })}
        <Box sx={{ flexGrow: 1 }} />
        {/* Time preset selector */}
        <Tooltip title="Time range">
          <Chip
            icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
            label={timePresets.find(t=>t.minutes===currentSinceMinutes)?.label || `${currentSinceMinutes}m`}
            size="small"
            onClick={openMenu(setAnchorTime)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        </Tooltip>
        <Menu anchorEl={anchorTime} open={Boolean(anchorTime)} onClose={closeMenu(setAnchorTime)}>
          {timePresets.map(t => (
            <MenuItem key={t.minutes} selected={t.minutes===currentSinceMinutes} onClick={() => applyTime(t.minutes)}>{t.label}</MenuItem>
          ))}
        </Menu>
        {/* Limit selector */}
        <Tooltip title="Items limit">
          <Chip
            icon={<ViewListIcon sx={{ fontSize: 16 }} />}
            label={currentLimit}
            size="small"
            onClick={openMenu(setAnchorLimit)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        </Tooltip>
        <Menu anchorEl={anchorLimit} open={Boolean(anchorLimit)} onClose={closeMenu(setAnchorLimit)}>
          {limitOptions.map(l => (
            <MenuItem key={l} selected={l===currentLimit} onClick={() => applyLimit(l)}>{l}</MenuItem>
          ))}
        </Menu>
        {/* Refresh selector */}
        <Tooltip title="Refresh interval (seconds)">
          <Chip
            label={`${currentRefresh}s`}
            size="small"
            onClick={openMenu(setAnchorRefresh)}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        </Tooltip>
        <Menu anchorEl={anchorRefresh} open={Boolean(anchorRefresh)} onClose={closeMenu(setAnchorRefresh)}>
          {refreshOptions.map(r => (
            <MenuItem key={r} selected={r===currentRefresh} onClick={() => applyRefresh(r)}>{r}s</MenuItem>
          ))}
        </Menu>
        <TextField
          size="small"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{
            minWidth: 200,
            maxWidth: 280,
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backdropFilter: 'blur(4px)'
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearSearch}>
                  <FilterAltOffIcon fontSize="inherit" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      </Stack>

      {/* Advanced section removed */}

      <Divider sx={{ mb: 1.5, opacity: 0.4 }} />

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>{error}</Typography>
      )}

      {!loading && filtered.length === 0 && !error && (
        <Typography variant="body2" sx={{ opacity: 0.75 }}>No matching issues in last {currentSinceMinutes} min.</Typography>
      )}

      <Box sx={{ maxHeight: 300, overflow: 'auto', pr: 0.5 }}>
        {loading && logs.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={46} animation="wave" sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        )}
        {filtered.map((l, idx) => {
          const isError = l.level === 'error';
          const accent = isError ? theme.palette.error.main : theme.palette.warning.main;
          return (
            <motion.div
              key={`${l.provider||'aws'}-${l.eventId}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.015 }}
            >
              <Box sx={{
                position: 'relative',
                p: 1.2,
                mb: 1,
                borderRadius: 2.5,
                background: isDark
                  ? 'linear-gradient(120deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%)'
                  : 'linear-gradient(120deg, rgba(255,255,255,0.85) 0%, rgba(250,250,250,0.60) 100%)',
                border: `1px solid ${alpha(accent, 0.25)}`,
                boxShadow: `0 2px 8px -2px ${alpha(accent, 0.35)}`,
                '&:hover': {
                  boxShadow: `0 4px 14px -2px ${alpha(accent, 0.45)}`,
                  transform: 'translateY(-2px)',
                  transition: 'all .25s ease'
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip size="small" label={l.level?.toUpperCase()} color={isError ? 'error':'warning'} sx={{ fontWeight: 600 }} />
                  <Chip size="small" label={(l.provider||'aws').toUpperCase()} variant="outlined" />
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {new Date(l.timestamp).toLocaleString()}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="Copy log line">
                    <IconButton size="small" onClick={() => handleCopy(l)}>
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', opacity: 0.85, display: 'block', mb: 0.5 }}>
                  {l.logGroup}{l.logStream ? ` / ${l.logStream}`: ''}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.4, fontSize: 13 }}>
                  {l.message}
                </Typography>
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Paper>
  );
}
