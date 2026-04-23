import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import MultiCloudIssueLogsCard from '../../components/common/Cards/MultiCloudIssueLogsCard';
import { Grid, Box, Typography, Chip, Divider, alpha, useTheme } from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { cloudMetricApi } from '../../services/api/cloudMetricApi';
import useCloudMetricsStream from '../../hooks/useCloudMetricsStream';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend);

const featureChips = [
  { icon: <CloudSyncIcon sx={{ fontSize: 18 }} />, label: 'Unified Providers' },
  { icon: <InsightsIcon sx={{ fontSize: 18 }} />, label: 'Real‑time Insights' },
  { icon: <SecurityIcon sx={{ fontSize: 18 }} />, label: 'Least‑Privilege Access' },
  { icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} />, label: 'AI Correlation (Soon)' }
];

export default function MultiCloud() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [series, setSeries] = useState({ providers: [], range: null });
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [banner, setBanner] = useState(null);
  const [sinceHours] = useState(12);

  const { latestAnomaly } = useCloudMetricsStream({
    onEvent: (payload, type) => {
      if (type === 'anomaly') {
        setBanner(payload);
        // Refresh charts to reflect latest metric spike
        loadSeries();
      }
    }
  });

  async function loadSeries() {
    try {
      setLoadingSeries(true);
      const res = await cloudMetricApi.getCostSeries({ sinceHours });
      const data = res?.data || res;
      setSeries(data || { providers: [], range: null });
    } catch (e) {
      console.error('Failed to load cost series', e.message);
    } finally {
      setLoadingSeries(false);
    }
  }

  useEffect(() => { loadSeries(); }, [sinceHours]);

  const chartData = useMemo(() => {
    const providers = series?.providers || [];
    const tsSet = new Set();
    providers.forEach((p) => (p.series || []).forEach((pt) => tsSet.add(new Date(pt.t).toISOString())));
    const labelsIso = Array.from(tsSet).sort();
    const labels = labelsIso.map((iso) => dayjs(iso).format('HH:mm'));
    const palette = { aws: '#F59E0B', azure: '#2563EB', gcp: '#059669' };

    const datasets = providers.map((p) => {
      const pointByIso = new Map((p.series || []).map((pt) => [new Date(pt.t).toISOString(), pt.cost]));
      const anomalyIso = new Set((p.anomalies || []).map((a) => new Date(a.t).toISOString()));
      return {
        label: `${p.provider?.toUpperCase() || 'AWS'} cost`,
        data: labelsIso.map((iso) => pointByIso.get(iso) ?? null),
        borderColor: palette[p.provider] || '#4B5563',
        backgroundColor: `${(palette[p.provider] || '#4B5563')}33`,
        fill: true,
        tension: 0.28,
        pointRadius: (ctx) => (anomalyIso.has(labelsIso[ctx.dataIndex]) ? 6 : 3),
        pointBackgroundColor: (ctx) => (anomalyIso.has(labelsIso[ctx.dataIndex]) ? '#EF4444' : (palette[p.provider] || '#4B5563')),
        spanGaps: true,
      };
    });

    const anomalies = (series?.providers || []).flatMap((p) =>
      (p.anomalies || []).map((a) => ({ ...a, provider: p.provider }))
    ).sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 6);

    return { labels, datasets, anomalies };
  }, [series]);

  return (
    <DashboardLayout title="Multi-Cloud Manager">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Box sx={{
          position: 'relative',
          mb: 6,
          p: { xs: 3, md: 5 },
          borderRadius: 5,
          overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, rgba(33,150,83,0.25) 0%, rgba(25,118,210,0.18) 50%, rgba(123,31,162,0.20) 100%)'
            : 'linear-gradient(135deg, rgba(129,199,132,0.35) 0%, rgba(100,181,246,0.25) 50%, rgba(206,147,216,0.30) 100%)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 10px 40px -5px rgba(0,0,0,0.25)',
          border: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.12)}`
        }}>
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Box sx={{
              position: 'absolute',
              width: 280,
              height: 280,
              top: -60,
              right: -40,
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.28), transparent 70%)',
              filter: 'blur(4px)',
              opacity: 0.5
            }} />
            <Box sx={{
              position: 'absolute',
              width: 220,
              height: 220,
              bottom: -40,
              left: -30,
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), transparent 70%)',
              filter: 'blur(6px)',
              opacity: 0.45
            }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.5px', mb: 2, background: 'linear-gradient(90deg,#8BC34A,#4CAF50,#3F51B5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Unified Multi‑Cloud Control
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, maxWidth: 880, lineHeight: 1.4, mb: 3, color: alpha(isDark ? '#FFFFFF' : '#0A0A0A', 0.85) }}>
            Correlate warnings & errors across AWS (Azure & GCP coming soon). Filter quickly, monitor provider health, and prepare for AI‑driven anomaly clustering.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
            {featureChips.map(ch => (
              <Chip
                key={ch.label}
                icon={ch.icon}
                label={ch.label}
                size="small"
                sx={{
                  fontWeight: 600,
                  px: 1,
                  bgcolor: alpha(isDark ? '#FFFFFF' : '#000000', 0.15),
                  color: alpha(isDark ? '#FFFFFF' : '#000000', 0.85),
                  backdropFilter: 'blur(6px)',
                  border: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.2)}`
                }}
              />
            ))}
          </Box>
        </Box>
      </motion.div>

      {/* Realtime anomaly banner */}
      {(banner || latestAnomaly) && (
        <Box sx={{ mb: 3, p: 2.5, borderRadius: 3, bgcolor: alpha('#EF4444', 0.08), border: `1px solid ${alpha('#EF4444', 0.22)}` }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#b91c1c', mb: 0.5 }}>
            Real-time cost spike detected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {banner?.provider?.toUpperCase() || latestAnomaly?.provider?.toUpperCase() || 'AWS'} cost is {Number((banner || latestAnomaly)?.latestCost || 0).toFixed(2)} (baseline {Number((banner || latestAnomaly)?.baseline || 0).toFixed(2)}). Severity {Math.min(100, Math.round((banner || latestAnomaly)?.severity || 0))}%.
          </Typography>
        </Box>
      )}

      {/* Content Section */}
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <Box sx={{
              p: 3,
              borderRadius: 4,
              background: isDark
                ? 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(245,245,245,0.7) 100%)',
              border: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.12)}`,
              boxShadow: '0 12px 30px -8px rgba(0,0,0,0.25)'
            }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Cost & Carbon Pulse (AWS • Azure • GCP)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Live series from the last {sinceHours}h with automatic spike detection. Red dots mark anomalies (GPU runaways, budget drifts, orphaned resources).
              </Typography>
              <Box sx={{ height: 360 }}>
                {loadingSeries ? (
                  <Box sx={{ height: '100%', borderRadius: 2, bgcolor: alpha(isDark ? '#FFFFFF' : '#000000', 0.04) }} />
                ) : (
                  <Line
                    data={{ labels: chartData.labels, datasets: chartData.datasets }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                          backgroundColor: theme.palette.background.paper,
                          borderColor: theme.palette.divider,
                          borderWidth: 1,
                          callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y || 0).toFixed(2)}`
                          }
                        }
                      },
                      scales: {
                        y: { title: { display: true, text: 'Cost (USD)' }, grid: { color: alpha('#000', 0.08) } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                )}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
                {(chartData.anomalies || []).map((a) => (
                  <Chip
                    key={`${a.provider}-${a.t}-${a.cost}`}
                    label={`${(a.provider || 'aws').toUpperCase()} spike at ${dayjs(a.t).format('HH:mm')} • $${Number(a.cost || a.latestCost || 0).toFixed(2)} (baseline ${Number(a.baseline || 0).toFixed(2)})`}
                    size="small"
                    sx={{ bgcolor: alpha('#EF4444', 0.12), color: '#b91c1c', border: `1px solid ${alpha('#EF4444', 0.32)}` }}
                  />
                ))}
                {(!chartData.anomalies || chartData.anomalies.length === 0) && (
                  <Typography variant="body2" color="text.secondary">No spikes detected in this window.</Typography>
                )}
              </Box>
            </Box>
          </motion.div>
        </Grid>
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
          >
            <MultiCloudIssueLogsCard sinceMinutes={120} limit={200} refreshSec={45} />
          </motion.div>
        </Grid>
        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
          >
            <Box sx={{
              p: 3.2,
              borderRadius: 4,
              position: 'relative',
              background: isDark
                ? 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(245,245,245,0.65) 100%)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 6px 24px -4px rgba(0,0,0,0.25)',
              border: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.12)}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'hidden'
            }}>
              <Box sx={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 85% 20%, rgba(76,175,80,0.25), transparent 60%)',
                pointerEvents: 'none'
              }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ position: 'relative' }}>Coming Soon</Typography>
              <Divider sx={{ opacity: 0.25 }} />
              <Typography variant="body2" color="text.secondary" sx={{ position: 'relative', lineHeight: 1.5 }}>
                This panel will evolve into an orchestration hub:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 3, pr: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography component="li" variant="body2" sx={{ lineHeight: 1.4 }}>Azure & GCP ingestion parity</Typography>
                <Typography component="li" variant="body2" sx={{ lineHeight: 1.4 }}>Cross‑provider anomaly clustering (AI)</Typography>
                <Typography component="li" variant="body2" sx={{ lineHeight: 1.4 }}>Cost & emission drift alerts</Typography>
                <Typography component="li" variant="body2" sx={{ lineHeight: 1.4 }}>Tag hygiene & orphan resource scans</Typography>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.65, mt: 1, position: 'relative' }}>
                Roadmap items based on real usage & feedback.
              </Typography>
            </Box>
          </motion.div>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}
