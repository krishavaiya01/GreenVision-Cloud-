import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Stack, Typography, TextField, IconButton, Button, Divider, Chip, Tooltip, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import RefreshIcon from '@mui/icons-material/Refresh';
import { assistantApi } from '../../services/api/assistantApi';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InsightsIcon from '@mui/icons-material/Insights';
import BugReportIcon from '@mui/icons-material/BugReport';
import PaidIcon from '@mui/icons-material/Paid';
import Co2Icon from '@mui/icons-material/Co2';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import AddCommentIcon from '@mui/icons-material/AddComment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

export default function AIAssistant() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]); // {role:'user'|'assistant', content:string}
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const chatEndRef = useRef(null);

  const loadContext = async () => {
    setCtxLoading(true);
    try {
      const res = await assistantApi.context();
      if (res?.data?.success) setContext(res.data.data);
    } catch (_) {}
    setCtxLoading(false);
  };

  useEffect(() => { loadContext(); }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const send = async () => {
    if (!message.trim()) return;
    const msg = message.trim();
    setMessage('');
    setHistory(h => [...h, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await assistantApi.chat({ message: msg, history });
      const data = res?.data?.data;
      const content = data?.reply || 'Done.';
      setHistory(h => [...h, { role: 'assistant', content, intent: data?.intent, rich: { context: data?.context, recommendations: data?.recommendations, issues: data?.issues } }]);
      if (data?.context) setContext(data.context);
    } catch (e) {
      setHistory(h => [...h, { role: 'assistant', content: 'Sorry, I hit an error.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendQuick = (text) => {
    setMessage(text);
    setTimeout(() => send(), 0);
  };

  const emailMe = async () => {
    try {
      await assistantApi.email();
      setHistory(h => [...h, { role: 'assistant', content: 'I emailed the latest summary to you.' }]);
    } catch (_) {
      setHistory(h => [...h, { role: 'assistant', content: 'Email failed.' }]);
    }
  };

  const newChat = async () => {
    try { await assistantApi.reset(); } catch (_) {}
    setHistory([]);
    setMessage('');
  };

  const RecommendationCard = ({ rec }) => (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
        {rec.type && <Chip size="small" color="primary" label={rec.type} />}
        {rec.priority && <Chip size="small" color={rec.priority==='high'?'error':rec.priority==='medium'?'warning':'default'} label={`priority: ${rec.priority}`} />}
        {rec.difficulty && <Chip size="small" label={`difficulty: ${rec.difficulty}`} />}
        {rec.provider && <Chip size="small" label={rec.provider.toUpperCase()} />}
        {rec.potentialSavings ? <Chip size="small" color="success" label={`~$${rec.potentialSavings}/mo`} /> : null}
      </Stack>
      <Typography variant="body2" sx={{ mb: 1 }}>{rec.description}</Typography>
      <Stack direction="row" spacing={1}>
        {rec.routePath && (
          <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate(rec.routePath)}>
            {rec.routeLabel || 'Open'}
          </Button>
        )}
        {rec.links?.[0]?.url && (
          <Button size="small" component="a" href={rec.links[0].url} target="_blank" rel="noopener">
            Docs
          </Button>
        )}
      </Stack>
    </Paper>
  );

  const MessageItem = ({ item }) => {
    const isUser = item.role === 'user';
    const bubbleBg = isUser
      ? theme.palette.primary.main
      : (theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.paper);
    const bubbleColor = isUser
      ? theme.palette.getContrastText(theme.palette.primary.main)
      : theme.palette.text.primary;
    return (
      <Stack direction={isUser ? 'row-reverse' : 'row'} spacing={1.25} alignItems="flex-end">
        <Avatar sx={{ bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary?.main || theme.palette.success.main, width: 28, height: 28 }}>
          {isUser ? <PersonOutlineIcon sx={{ fontSize: 18, color: theme.palette.primary.contrastText }} /> : <SmartToyIcon sx={{ fontSize: 18, color: theme.palette.getContrastText((theme.palette.secondary?.main || theme.palette.success.main)) }} />}
        </Avatar>
        <Paper elevation={1} sx={{
          px: 1.5,
          py: 1,
          maxWidth: '80%',
          bgcolor: bubbleBg,
          color: bubbleColor,
          borderRadius: 2,
          border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
        }}>
          <Typography variant="body2" color="inherit">{item.content}</Typography>
          {item.role === 'assistant' && (item.rich?.recommendations || item.rich?.context || item.rich?.issues) && (
            <AssistantRich rich={item.rich} intent={item.intent} />
          )}
          <Typography variant="caption" color="inherit" sx={{ opacity: 0.8, display: 'block', mt: 0.25 }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Paper>
      </Stack>
    );
  };

  const AssistantRich = ({ rich, intent }) => {
    if (!rich) return null;
    const hasRecs = Array.isArray(rich.recommendations) && rich.recommendations.length>0;
    const ctx = rich.context;
    const issues = rich.issues;
    return (
      <Stack spacing={1} sx={{ mt: 0.5 }}>
        {ctx && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: theme.palette.background.paper, color: theme.palette.text.primary }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Snapshot</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
              <Chip label={`Cost $${Number(ctx?.totals?.cost||0).toFixed(2)}`} />
              <Chip label={`Carbon ${Number(ctx?.totals?.carbon||0).toFixed(2)} kg`} />
              <Chip label={`Instances ${ctx?.totals?.instances || 0}`} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {['aws','azure','gcp'].map(p => {
                const m = ctx?.metrics?.[p];
                if (!m) return <Paper key={p} variant="outlined" sx={{ p: 1, flex: 1, opacity: 0.6 }}><Typography variant="caption">{p.toUpperCase()} — no data</Typography></Paper>;
                return (
                  <Paper key={p} variant="outlined" sx={{ p: 1, flex: 1, bgcolor: theme.palette.background.default }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{p.toUpperCase()}</Typography>
                    <Typography variant="body2">Inst: {m.totalInstances} • CPU: {m.avgCPU}%</Typography>
                    <Typography variant="body2">Cost: ${Number(m.cost||0).toFixed(2)} • CO₂: {Number(m.carbon||0).toFixed(2)} kg</Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        )}
        {hasRecs && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Top Recommendations</Typography>
            {rich.recommendations.slice(0,5).map((rec, i) => <RecommendationCard key={i} rec={rec} />)}
          </Box>
        )}
        {issues && (
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: theme.palette.background.paper, color: theme.palette.text.primary }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent Issues</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
              <Chip color="error" label={`Errors ${issues?.levels?.error || 0}`} />
              <Chip color="warning" label={`Warnings ${issues?.levels?.warn || 0}`} />
              <Chip label={`Total ${issues?.total || 0}`} />
            </Stack>
            {/* Per-provider breakdown if available */}
            {issues?.byProvider && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
                {['aws','azure','gcp'].map(p => (
                  <Chip key={p} label={`${p.toUpperCase()}: ${issues?.byProvider?.[p]?.total || 0}`} />
                ))}
              </Stack>
            )}
            {Array.isArray(issues.sample) && issues.sample.slice(0,3).map((it, idx) => (
              <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                {(it.timestamp ? new Date(it.timestamp).toLocaleString() : '')} — {it.provider ? `[${it.provider.toUpperCase()}] ` : ''}{(it.level || '').toUpperCase()}: {(it.message || '').slice(0,140)}
              </Typography>
            ))}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" onClick={() => navigate('/cloud-monitoring/aws')}>Open Cloud Monitoring</Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    );
  };

  return (
    <DashboardLayout title="AI Assistant">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.8fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">GreenVision AI Assistant</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Start a new chat">
              <span><Button size="small" startIcon={<AddCommentIcon />} onClick={newChat} variant="outlined">New chat</Button></span>
            </Tooltip>
            <Tooltip title="Email summary">
              <span><Button size="small" startIcon={<EmailIcon />} onClick={emailMe} variant="outlined">Email summary</Button></span>
            </Tooltip>
            <Tooltip title="Refresh context"><span><IconButton onClick={loadContext} disabled={ctxLoading}><RefreshIcon /></IconButton></span></Tooltip>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 2 }} />

          {/* Quick actions */}
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="contained" color="primary" startIcon={<InsightsIcon />} onClick={() => sendQuick('give me summary of my project short')} sx={{ textTransform: 'none' }}>Project summary</Button>
            <Button size="small" variant="contained" color="primary" startIcon={<PaidIcon />} onClick={() => sendQuick('cost status')} sx={{ textTransform: 'none' }}>Cost snapshot</Button>
            <Button size="small" variant="contained" color="primary" startIcon={<Co2Icon />} onClick={() => sendQuick('carbon emission CO2')} sx={{ textTransform: 'none' }}>Carbon snapshot</Button>
            <Button size="small" variant="contained" color="primary" startIcon={<InsightsIcon />} onClick={() => sendQuick('Recommend optimizations to reduce cost')} sx={{ textTransform: 'none' }}>Recommend optimizations</Button>
            <Button size="small" variant="contained" color="primary" startIcon={<BugReportIcon />} onClick={() => sendQuick('Show recent errors and warnings')} sx={{ textTransform: 'none' }}>Show recent errors and warnings</Button>
          </Stack>

        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25, pr: 0.5 }}>
          {history.length === 0 ? (
            <Typography color={theme.palette.text.secondary}>Ask about cost, carbon, logs, or say "recommend optimizations".</Typography>
          ) : history.map((m, i) => (
            <MessageItem key={i} item={m} />
          ))}
          <div ref={chatEndRef} />
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.common.white,
                borderRadius: 2,
                '& fieldset': {
                  borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
                  borderWidth: 1,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[600] : theme.palette.grey[400],
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[500],
                },
              },
              '& .MuiInputBase-input': {
                color: theme.palette.text.primary,
                caretColor: theme.palette.primary.main,
                fontSize: 14,
                lineHeight: 1.6,
                '::placeholder': {
                  color: theme.palette.text.secondary,
                  opacity: 1,
                },
                '::-webkit-input-placeholder': {
                  color: theme.palette.text.secondary,
                  opacity: 1,
                },
                '::-moz-placeholder': {
                  color: theme.palette.text.secondary,
                  opacity: 1,
                },
                ':-ms-input-placeholder': {
                  color: theme.palette.text.secondary,
                  opacity: 1,
                },
              },
            }}
          />
          <IconButton color="primary" onClick={send} disabled={loading || !message.trim()}>
            <SendIcon />
          </IconButton>
        </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Context</Typography>
          <Chip size="small" label={context?.generatedAt ? new Date(context.generatedAt).toLocaleTimeString() : '—'} />
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {ctxLoading ? <Typography>Loading...</Typography> : !context ? (
          <Typography color="text.secondary">No context yet.</Typography>
        ) : (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Totals</Typography>
            <Typography variant="body2">Cost: ${Number(context?.totals?.cost || 0).toFixed(2)} | Carbon: {Number(context?.totals?.carbon || 0).toFixed(2)} kg | Instances: {context?.totals?.instances || 0}</Typography>
            <Divider />
            <Typography variant="subtitle2">Providers</Typography>
            {['aws','azure','gcp'].map(p => {
              const m = context?.metrics?.[p];
              return (
                <Typography key={p} variant="body2">{p.toUpperCase()}: {m ? `${m.totalInstances} inst • ${m.avgCPU}% CPU • $${Number(m.cost||0).toFixed(2)} • ${Number(m.carbon||0).toFixed(2)} kg` : '—'}</Typography>
              );
            })}
            <Divider />
            <Typography variant="subtitle2">Top Recommendations</Typography>
            {(context?.recommendations || []).map((r, i) => (
              <Typography key={i} variant="body2">• {r.description}{r.potentialSavings ? ` (~$${r.potentialSavings}/mo)` : ''}</Typography>
            ))}
            <Divider />
            <Typography variant="subtitle2">Recent Issues</Typography>
            <Typography variant="body2">Total: {context?.issues?.total || 0} | Errors: {context?.issues?.levels?.error || 0} | Warn: {context?.issues?.levels?.warn || 0}</Typography>
          </Stack>
        )}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
