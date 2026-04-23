// src/pages/dashboard/AIRecommendations.jsx
import React, { useEffect, useMemo, useState } from "react";
import { aiApi } from "../../services/api/aiApi";
import { notificationApi } from "../../services/api/notificationApi";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Grid,
  Skeleton,
  Divider,
  Pagination,
  Link,
  Stack,
  Button
} from "@mui/material";
import {
  EmojiEvents,
  TrendingUp,
  WarningAmber,
  CheckCircle,
  Info,
  Bolt,
} from "@mui/icons-material";
import DashboardLayout from "../../components/common/Layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useTheme, alpha } from "@mui/material/styles";
import { motion } from "framer-motion";

export default function AIRecommendations() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [recommendations, setRecommendations] = useState([]);
  const [logSummary, setLogSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filters & sorting
  const [providerFilter, setProviderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortKey, setSortKey] = useState('impact'); // impact | confidence | priority | savings

  const filteredSorted = useMemo(() => {
    const toPriorityScore = (p) => ({ critical: 3, high: 2, medium: 1, low: 0 })[p?.toLowerCase?.()] ?? 0;
    let list = [...recommendations];
    if (providerFilter !== 'all') list = list.filter(r => r.provider === providerFilter);
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter);
    if (priorityFilter !== 'all') list = list.filter(r => (r.priority||'').toLowerCase() === priorityFilter);
    list.sort((a,b) => {
      if (sortKey === 'impact') return (b.potentialSavings||0) - (a.potentialSavings||0);
      if (sortKey === 'confidence') return (b.confidence||0) - (a.confidence||0);
      if (sortKey === 'priority') return toPriorityScore(b.priority) - toPriorityScore(a.priority);
      if (sortKey === 'savings') return (b.potentialSavings||0) - (a.potentialSavings||0);
      return 0;
    });
    return list;
  }, [recommendations, providerFilter, typeFilter, priorityFilter, sortKey]);

  useEffect(() => {
    aiApi
      .getRecommendations()
      .then((data) => {
        const recs = data?.data?.recommendations || [];
        setRecommendations(recs);
        setLogSummary(data?.data?.logSummary || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch recommendations");
        setLoading(false);
      });
  }, []);

  // Priority color mapping and icons
  const priorityMap = {
    high: {
      color: "#e53935",
      label: "High",
      icon: <WarningAmber sx={{ color: "#e53935" }} />,
    },
    medium: {
      color: "#fb8c00",
      label: "Medium",
      icon: <Bolt sx={{ color: "#fb8c00" }} />,
    },
    low: {
      color: "#43a047",
      label: "Low",
      icon: <CheckCircle sx={{ color: "#43a047" }} />,
    },
    critical: {
      color: "#d32f2f",
      label: "Critical",
      icon: <WarningAmber sx={{ color: "#d32f2f" }} />,
    },
    normal: {
      color: "#1e88e5",
      label: "Normal",
      icon: <Info sx={{ color: "#1e88e5" }} />,
    },
    moderate: {
      color: "#fbc02d",
      label: "Moderate",
      icon: <TrendingUp sx={{ color: "#fbc02d" }} />,
    },
    default: {
      color: "#757575",
      label: "Default",
      icon: <Info sx={{ color: "#757575" }} />,
    },
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: { xs: 9, md: 9 }, maxWidth: 1100, ml: { xs: 0, md: 4 }, mr: "auto", textAlign: "left" }}>
        {/* Hero header with subtle gradient and glow */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          sx={{
            mb: 2,
            p: 2.5,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.10)} 100%)`,
            boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`
          }}
        >
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: 0.2 }}>
            AI Recommendations
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
            Data-driven, actionable suggestions to cut cost, lower emissions, and boost reliability.
          </Typography>
        </Box>
        {/* Actions */}
        {!loading && (
          <Box sx={{ display:'flex', gap:1, mb:2 }}>
            <Button
              variant="contained"
              size="small"
              disabled={emailSending}
              onClick={async ()=>{
                try {
                  setEmailSending(true);
                  setEmailResult(null);
                  const res = await notificationApi.sendRecommendationsEmail();
                  setEmailResult({ ok: true, msg: res?.message || 'Email sent' });
                } catch (e) {
                  setEmailResult({ ok: false, msg: e?.response?.data?.message || e.message || 'Failed to send email' });
                } finally {
                  setEmailSending(false);
                }
              }}
            >
              {emailSending ? 'Sending email…' : 'Email me this summary'}
            </Button>
            {emailResult && (
              <Typography variant="body2" sx={{ ml:1 }} color={emailResult.ok? 'success.main' : 'error.main'}>
                {emailResult.msg}
              </Typography>
            )}
          </Box>
        )}
        {logSummary && !loading && (
          <Paper
            component={motion.div}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            sx={{
              p:2.5,
              borderRadius:3,
              mb:3,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              backdropFilter: 'blur(6px)'
            }}
            elevation={3}
          >
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Recent Log Issue Analysis (last {logSummary.lookbackMinutes}m)
            </Typography>
            {logSummary.error && (
              <Typography color="error" variant="body2">{logSummary.error}</Typography>
            )}
            {!logSummary.error && (
              <Box>
                <Box sx={{ display:'flex', flexWrap:'wrap', gap:1, mb:1 }}>
                  <Chip size="small" color="error" label={`Errors: ${logSummary.levels?.error || 0}`} />
                  <Chip size="small" color="warning" label={`Warnings: ${logSummary.levels?.warn || 0}`} />
                  <Chip size="small" variant="outlined" label={`Total Issues: ${logSummary.total || 0}`} />
                  {typeof logSummary.estimatedStorageGB === 'number' && (
                    <Chip size="small" color="info" label={`Storage: ${logSummary.estimatedStorageGB} GB`} />
                  )}
                  {typeof logSummary.estimatedMonthlyStorageCost === 'number' && (
                    <Chip size="small" color="success" label={`Cost: $${logSummary.estimatedMonthlyStorageCost}`} />
                  )}
                  {typeof logSummary.estimatedCarbonKg === 'number' && (
                    <Chip size="small" color="secondary" label={`Carbon: ${logSummary.estimatedCarbonKg} kg CO₂e`} />
                  )}
                </Box>
                {logSummary.topGroups?.length > 0 && (
                  <Box sx={{ mb:1 }}>
                    <Typography variant="caption" sx={{ fontWeight:600, opacity:0.8, display:'block', mb:0.5 }}>Top Noisy Log Groups</Typography>
                    <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.75 }}>
                      {logSummary.topGroups.map(g => (
                        <Chip key={g.group} size="small" label={`${g.group} (${g.count})`} />
                      ))}
                    </Box>
                  </Box>
                )}
                {logSummary.noisyPatterns?.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight:600, opacity:0.8, display:'block', mb:0.5 }}>Repeated Patterns</Typography>
                    <Box sx={{ display:'flex', flexDirection:'column', gap:0.5 }}>
                      {logSummary.noisyPatterns.map((p,i)=>(
                        <Typography key={i} variant="caption" sx={{ fontFamily:'monospace', opacity:0.75 }}>
                          {p.snippet.slice(0,80)}... ({p.count})
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        )}

        {/* Controls: Filters & Sorting */}
        {!loading && (
          <Paper sx={{ p: 2, borderRadius: 3, mb: 2, display: 'flex', gap: 1.5, flexWrap:'wrap', alignItems:'center' }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Filter:</Typography>
            <Chip size="small" label="All Providers" color={providerFilter==='all'?'primary':'default'} onClick={()=>setProviderFilter('all')} />
            <Chip size="small" label="AWS" color={providerFilter==='aws'?'primary':'default'} onClick={()=>setProviderFilter('aws')} />
            <Chip size="small" label="Azure" color={providerFilter==='azure'?'primary':'default'} onClick={()=>setProviderFilter('azure')} />
            <Chip size="small" label="GCP" color={providerFilter==='gcp'?'primary':'default'} onClick={()=>setProviderFilter('gcp')} />
            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
            <Chip size="small" label="All Types" color={typeFilter==='all'?'primary':'default'} onClick={()=>setTypeFilter('all')} />
            {['resize','performance','carbon','migration','cost','stability','noise-reduction','cleanup','governance'].map(t => (
              <Chip key={t} size="small" label={t} color={typeFilter===t?'primary':'default'} onClick={()=>setTypeFilter(t)} />
            ))}
            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
            <Chip size="small" label="All Priorities" color={priorityFilter==='all'?'primary':'default'} onClick={()=>setPriorityFilter('all')} />
            {['high','medium','low','critical'].map(p => (
              <Chip key={p} size="small" label={p} color={priorityFilter===p?'primary':'default'} onClick={()=>setPriorityFilter(p)} />
            ))}
            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Sort:</Typography>
            {['impact','confidence','priority','savings'].map(k => (
              <Chip key={k} size="small" label={k} color={sortKey===k?'secondary':'default'} onClick={()=>setSortKey(k)} />
            ))}
          </Paper>
        )}

        {loading && (
          <Grid container spacing={2}>
            {[...Array(3)].map((_, i) => (
              <Grid item xs={12} md={6} key={i}>
                <Skeleton variant="rounded" height={140} />
              </Grid>
            ))}
          </Grid>
        )}

        {error && (
          <Typography color="error" variant="body1" align="left">
            {error}
          </Typography>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <Paper sx={{ p: 3, borderRadius: 3, textAlign: "left" }}>
            <Typography variant="body1" color="text.secondary">
              No recommendations available yet. Keep monitoring your usage 🚀
            </Typography>
          </Paper>
        )}

        {/* Paged Recommendations */}
        <Grid container spacing={2}>
          {filteredSorted
            .slice((page-1)*pageSize, page*pageSize)
            .map((rec, idx) => {
            const priority =
              priorityMap[rec.priority?.toLowerCase()] || priorityMap.default;

            return (
              <Grid item xs={12} md={6} key={idx}>
                <Paper
                  component={motion.div}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.03 }}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    minHeight: 160,
                    position: 'relative',
                    overflow: 'hidden',
                    background:
                      theme.palette.mode === 'dark'
                        ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.85)}, ${alpha(theme.palette.background.default, 0.7)})`
                        : `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.default, 0.8)})`,
                    border: `1px solid ${alpha(priority.color, 0.35)}`,
                    boxShadow: `0 10px 24px ${alpha(priority.color, 0.18)}`,
                  }}
                  elevation={0}
                >
  {/* Title row with icon */}
  <Box display="flex" alignItems="center" gap={1}>
    {priority.icon}
    <Typography variant="h6" fontWeight={600}>
      {rec.type?.toUpperCase() || "Recommendation"}
    </Typography>
    {rec.provider && (
      <Chip size="small" label={rec.provider.toUpperCase()} sx={{ ml: 1 }} />
    )}
  </Box>

  {/* Description */}
  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.4 }}>
    {rec.description}
  </Typography>

  <Divider sx={{ my: 1 }} />

  {/* Chips below description, in one row */}
  <Box display="flex" flexWrap="wrap" gap={1}>
    <Chip
      label={`Priority: ${priority.label}`}
      sx={{ bgcolor: priority.color, color: "white", boxShadow: `0 0 0 1px ${alpha(priority.color, 0.25)}` }}
      size="small"
    />
    <Chip
      label={`Difficulty: ${rec.difficulty}`}
      size="small"
      color="secondary"
    />
    <Chip
      label={`Confidence: ${rec.confidence}%`}
      size="small"
      color="info"
    />
    {rec.potentialSavings > 0 && (
      <Chip
        label={`💰 Savings: $${rec.potentialSavings}`}
        size="small"
        color="success"
      />
    )}
    {/* Evidence badges */}
    {rec.evidence?.avgCPU !== undefined && (
      <Chip size="small" variant="outlined" label={`avgCPU: ${rec.evidence.avgCPU}%`} />
    )}
    {rec.evidence?.instances !== undefined && (
      <Chip size="small" variant="outlined" label={`instances: ${rec.evidence.instances}`} />
    )}
    {rec.evidence?.carbonPerDollar !== undefined && (
      <Chip size="small" variant="outlined" label={`CO₂/$: ${rec.evidence.carbonPerDollar}`} />
    )}
    {rec.evidence?.errors !== undefined && (
      <Chip size="small" variant="outlined" label={`errors: ${rec.evidence.errors}`} />
    )}
    {rec.evidence?.warnings !== undefined && (
      <Chip size="small" variant="outlined" label={`warn: ${rec.evidence.warnings}`} />
    )}
    {rec.evidence?.issues !== undefined && (
      <Chip size="small" variant="outlined" label={`issues: ${rec.evidence.issues}`} />
    )}
    {rec.evidence?.storageGB !== undefined && (
      <Chip size="small" variant="outlined" label={`storage: ${rec.evidence.storageGB} GB`} />
    )}
    {rec.evidence?.monthlyCost !== undefined && (
      <Chip size="small" variant="outlined" label={`logs: $${rec.evidence.monthlyCost}/mo`} />
    )}
    {rec.evidence?.carbonKg !== undefined && (
      <Chip size="small" variant="outlined" label={`carbon: ${rec.evidence.carbonKg} kg`} />
    )}
  </Box>
  {rec.links && rec.links.length > 0 && (
    <Stack direction="column" spacing={0.5} sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ fontWeight:600, opacity:0.7 }}>Remediation Links:</Typography>
      {rec.links.map((ln,i)=>(
        <Link key={i} href={ln.url} target="_blank" rel="noopener" variant="caption" underline="hover">
          {ln.label}
        </Link>
      ))}
    </Stack>
  )}

  {/* CTA buttons */}
  <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mt: 1 }}>
    {rec.routePath && (
      <Button
        component={motion.button}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        variant="contained"
        size="small"
        onClick={()=>navigate(rec.routePath)}
      >
        {rec.routeLabel || 'Open Details'}
      </Button>
    )}
    {/* Secondary quick links based on provider */}
    {rec.provider && (
      <>
        {(rec.provider === 'aws' || rec.provider === 'azure' || rec.provider === 'gcp') && (
          <Button
            component={motion.button}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            variant="outlined"
            size="small"
            onClick={()=>navigate(`/cloud-monitoring/${rec.provider}`)}
          >
            Open {rec.provider.toUpperCase()} Monitoring
          </Button>
        )}
      </>
    )}
  </Box>
</Paper>

              </Grid>
            );
          })}
        </Grid>
        {filteredSorted.length > pageSize && (
          <Box sx={{ display:'flex', justifyContent:'center', mt:3 }}>
            <Pagination
              count={Math.ceil(filteredSorted.length / pageSize)}
              page={page}
              onChange={(_,val)=>setPage(val)}
              color="primary"
              shape="rounded"
            />
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}
