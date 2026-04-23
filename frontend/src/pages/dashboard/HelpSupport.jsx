import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip,
  IconButton,
  alpha,
  useTheme,
  Link as MuiLink,
  Stack,
  Badge
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EmailIcon from '@mui/icons-material/Email';
import ArticleIcon from '@mui/icons-material/Article';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OfflineBoltIcon from '@mui/icons-material/OfflineBolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

const faqItems = [
  { q: 'How is carbon footprint calculated?', a: 'We aggregate provider usage (GB,s,bytes) and apply energy intensity + regional carbon factors, normalizing per provider. Real-time updates stream every 15s.' },
  { q: 'Why do some providers show simulated data?', a: 'Until connected via credentials or ingestion pipelines, Azure & GCP values are simulated using heuristic scaling models.' },
  { q: 'How do AI recommendations work?', a: 'A rule engine analyzes recent logs & emissions trends. When trained data is present, it blends heuristic + learned scoring.' },
  { q: 'Can I export my emissions history?', a: 'Yes, use the export actions on Carbon Tracking to download CSV snapshots or aggregated provider windows.' },
  { q: 'Is my data secure?', a: 'All API calls require JWT auth. Sensitive fields are encrypted at rest. We never store raw credential secrets in plain text.' }
];

const resourceLinks = [
  { label: 'Documentation', icon: ArticleIcon, url: '#', desc: 'Platform guides & concepts' },
  { label: 'API Reference', icon: AutoAwesomeIcon, url: '#', desc: 'REST endpoints & schemas' },
  { label: 'Changelog', icon: RocketLaunchIcon, url: '#', desc: 'New features & fixes' },
  { label: 'Best Practices', icon: TipsAndUpdatesIcon, url: '#', desc: 'Optimization & sustainability tips' }
];

const shortcuts = [
  { keys: ['G','D'], desc: 'Go to Dashboard' },
  { keys: ['G','C'], desc: 'Open Carbon Tracking' },
  { keys: ['G','A'], desc: 'Analytics' },
  { keys: ['?'], desc: 'Toggle Help Overlay (planned)' },
];

export default function HelpSupport() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMode] = useState('operational'); // could be dynamic later

  const filteredFaq = useMemo(() => faqItems.filter(f => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())), [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !message) {
      toast.error('Email & message required');
      return;
    }
    setSending(true);
    setTimeout(()=>{
      toast.success('Support request submitted');
      setEmail('');
      setMessage('');
      setSubject('');
      setSending(false);
    }, 900);
  };

  const glass = (opacity=0.12) => ({
    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, opacity)} 0%, ${alpha(theme.palette.secondary.main, opacity*0.85)} 100%)`,
    border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
    backdropFilter: 'blur(14px)',
  });

  const pulseColor = statusMode==='operational' ? theme.palette.success.main : theme.palette.warning.main;

  return (
    <DashboardLayout title="Help & Support">
      <Box sx={{ display:'flex', flexDirection:'column', gap:4, pb:6 }}>
        {/* Hero */}
        <Paper sx={{ p:5, borderRadius:4, position:'relative', overflow:'hidden', ...glass(0.18) }}>
          <motion.div
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.6 }}
          >
            <Typography variant="h3" fontWeight={700} gutterBottom sx={{ background: `linear-gradient(90deg, ${theme.palette.primary.light}, ${theme.palette.success.main})`, WebkitBackgroundClip:'text', color:'transparent' }}>
              How can we help?
            </Typography>
            <Typography variant="h6" sx={{ opacity:0.8, maxWidth:700 }}>
              Explore guides, FAQs, status insights, and direct support to get the most out of GreenVision Cloud.
            </Typography>
            <Box mt={4} maxWidth={480}>
              <TextField
                fullWidth
                placeholder="Search FAQs, topics, features..."
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                variant="outlined"
                InputProps={{ sx:{ borderRadius:3, background: alpha(theme.palette.background.paper, 0.6), backdropFilter:'blur(6px)' } }}
              />
            </Box>
          </motion.div>

          <Box sx={{ position:'absolute', inset:0, pointerEvents:'none', '&:before':{
            content:'""', position:'absolute', width:360, height:360, top:-80, right:-80,
            background:`radial-gradient(circle at center, ${alpha(theme.palette.primary.main,0.55)}, transparent 70%)`, filter:'blur(60px)' }
          }} />
        </Paper>

        <Grid container spacing={3}>
          {/* FAQ */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p:3, borderRadius:3, ...glass(0.14) }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <HelpOutlineIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>Frequently Asked Questions</Typography>
                <Chip size="small" label={filteredFaq.length + ' results'} />
              </Stack>
              <Divider sx={{ mb:2 }} />
              {filteredFaq.map((f,i)=>(
                <Accordion key={f.q} disableGutters sx={{ background:'transparent', boxShadow:'none', '&:before':{ display:'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
                    <Typography fontWeight={600}>{f.q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ opacity:0.85 }}>{f.a}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
              {filteredFaq.length===0 && (
                <Typography variant="body2" sx={{ opacity:0.7 }}>No matches. Try a different term.</Typography>
              )}
            </Paper>
          </Grid>

          {/* Contact & Status */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Paper sx={{ p:3, borderRadius:3, ...glass(0.14) }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <SupportAgentIcon color="secondary" />
                  <Typography variant="h6" fontWeight={600}>Contact Support</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mb:2, opacity:0.75 }}>Send us a message and we will respond within 24 hours.</Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <TextField size="small" label="Email" value={email} onChange={(e)=>setEmail(e.target.value)} fullWidth />
                  <TextField size="small" label="Subject" value={subject} onChange={(e)=>setSubject(e.target.value)} fullWidth />
                  <TextField size="small" label="Message" value={message} onChange={(e)=>setMessage(e.target.value)} fullWidth multiline minRows={4} />
                  <Button type="submit" variant="contained" disabled={sending}>{sending? 'Sending...' : 'Send Message'}</Button>
                </Box>
              </Paper>

              <Paper sx={{ p:3, borderRadius:3, position:'relative', overflow:'hidden', ...glass(0.14) }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <OfflineBoltIcon color="warning" />
                  <Typography variant="h6" fontWeight={600}>System Status</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ position:'relative', width:14, height:14 }}>
                    <Box sx={{ position:'absolute', inset:0, borderRadius:'50%', background:pulseColor, animation:'pulse 2.4s ease-in-out infinite' }} />
                    <Box sx={{ position:'absolute', inset:2, borderRadius:'50%', background:pulseColor }} />
                  </Box>
                  <Typography variant="body2" fontWeight={600}>{statusMode==='operational' ? 'All Systems Operational' : 'Partial Degradation'}</Typography>
                </Stack>
                <Typography variant="caption" sx={{ opacity:0.6 }}>Updated just now</Typography>
                <Box mt={2} display="flex" flexWrap="wrap" gap={1}>
                  <Chip icon={<CheckCircleIcon />} color="success" size="small" label="API" />
                  <Chip icon={<CheckCircleIcon />} color="success" size="small" label="Realtime" />
                  <Chip icon={<CheckCircleIcon />} color="success" size="small" label="Ingestion" />
                  <Chip icon={<CheckCircleIcon />} color="success" size="small" label="AI Engine" />
                </Box>
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        {/* Resources */}
        <Paper sx={{ p:4, borderRadius:3, ...glass(0.16) }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <InfoOutlinedIcon color="info" />
            <Typography variant="h6" fontWeight={600}>Resources</Typography>
          </Stack>
          <Grid container spacing={2}>
            {resourceLinks.map(card => {
              const Icon = card.icon;
              return (
                <Grid item xs={12} sm={6} md={3} key={card.label}>
                  <Paper component={motion.div} whileHover={{ y:-6, boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }} transition={{ type:'spring', stiffness:210, damping:22 }}
                    sx={{ p:2.5, height:'100%', borderRadius:3, cursor:'pointer', position:'relative', overflow:'hidden', ...glass(0.18), display:'flex', flexDirection:'column', gap:1 }} onClick={()=>toast.success('Opening '+card.label)}>
                    <Box sx={{ width:44, height:44, borderRadius:2, display:'flex', alignItems:'center', justifyContent:'center', background:alpha(theme.palette.primary.main,0.15) }}>
                      <Icon color="primary" />
                    </Box>
                    <Typography fontWeight={600}>{card.label}</Typography>
                    <Typography variant="caption" sx={{ flexGrow:1, opacity:0.7 }}>{card.desc}</Typography>
                    <Typography variant="caption" sx={{ fontSize:11, opacity:0.5 }}>Click to open</Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>

        
      </Box>

      <style>{`
        @keyframes pulse { 0%,100%{ transform:scale(1); opacity:0.6 } 50%{ transform:scale(1.35); opacity:0 } }
      `}</style>
    </DashboardLayout>
  );
}
