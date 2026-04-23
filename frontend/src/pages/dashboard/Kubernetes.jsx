import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import { Box, Paper, Tabs, Tab, Typography, Grid, Chip, Skeleton, Stack, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions } from '@mui/material';
import { k8sApi } from '../../services/api/k8sApi';
import { useSearchParams } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';

const Section = ({ title, children, loading }) => (
  <Paper sx={{ p:2, borderRadius:2 }}>
    <Typography variant="subtitle2" sx={{ mb:1 }}>{title}</Typography>
    {loading ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1 }} /> : children}
  </Paper>
);

export default function Kubernetes() {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const initialProvider = ['aws','azure','gcp'].includes((searchParams.get('provider')||'').toLowerCase()) ? searchParams.get('provider').toLowerCase() : 'aws';
  const [provider, setProvider] = useState(initialProvider);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState({ provider: 'aws', name: '', kubeconfig: '' });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    k8sApi.getInventory(provider).then(d => { if (mounted) { setData(d?.data||null); setLoading(false); } });
    return () => { mounted = false; };
  }, [provider]);

  const pods = data?.pods || [];
  const services = data?.services || [];
  const nodes = data?.nodes || [];
  const namespaces = data?.namespaces || [];
  const summary = data?.summary || { totalCost: 0, avgCpu: 0, avgMem: 0 };

  return (
    <DashboardLayout title="Kubernetes">
      <Box sx={{ p:2 }}>
        <Paper sx={{ p:1, mb:2, borderRadius:2 }}>
          <Tabs value={provider} onChange={(_,v)=>setProvider(v)}>
            <Tab label="AWS EKS" value="aws" />
            <Tab label="Azure AKS" value="azure" />
            <Tab label="GCP GKE" value="gcp" />
          </Tabs>
          <Box sx={{ textAlign:'right', mt:1 }}>
            <Button variant="contained" size="small" onClick={()=>{ setForm(f=>({ ...f, provider })); setConnectOpen(true); }}>Connect Cluster</Button>
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Section title="Cluster Summary" loading={loading}>
              <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap' }}>
                <Chip label={`Pods: ${pods.length}`} />
                <Chip label={`Services: ${services.length}`} />
                <Chip label={`Nodes: ${nodes.length}`} />
                <Chip color="success" label={`Avg CPU: ${summary.avgCpu}%`} />
                <Chip color="info" label={`Avg Mem: ${summary.avgMem}%`} />
                <Chip color="secondary" label={`Cost/mo: $${summary.totalCost}`} />
              </Stack>
            </Section>
          </Grid>
          <Grid item xs={12} md={8}>
            <Section title="Namespaces (Utilization & Cost)" loading={loading}>
              <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap' }}>
                {namespaces.map(ns => (
                  <Chip key={ns.name} variant="outlined" label={`${ns.name} • CPU ${ns.cpuAvg}% • MEM ${ns.memAvg}MB • $${ns.costMonthly}/mo`} />
                ))}
              </Stack>
            </Section>
          </Grid>

          <Grid item xs={12} md={6}>
            <Section title="Pods" loading={loading}>
              <Stack spacing={0.75}>
                {pods.map(p => (
                  <Typography key={p.name} variant="body2">{p.namespace}/{p.name} — {p.status} • CPU {p.cpu}% • MEM {p.memory}MB</Typography>
                ))}
              </Stack>
            </Section>
          </Grid>
          <Grid item xs={12} md={6}>
            <Section title="Services" loading={loading}>
              <Stack spacing={0.75}>
                {services.map(s => (
                  <Typography key={s.name} variant="body2">{s.namespace}/{s.name} — {s.type}</Typography>
                ))}
              </Stack>
            </Section>
          </Grid>

          {/* Side-by-side provider pods for quick verification */}
          <Grid item xs={12}>
            <Section title="Pods by Provider (Real Data)" loading={false}>
              <Grid container spacing={2}>
                {['aws','azure','gcp'].map(p => (
                  <ProviderPods key={p} provider={p} />
                ))}
              </Grid>
            </Section>
          </Grid>

          <Grid item xs={12}>
            <Section title="Nodes" loading={loading}>
              <Grid container spacing={1}>
                {nodes.map(n => (
                  <Grid item xs={12} md={4} key={n.name}>
                    <Paper sx={{ p:1.5, borderRadius:2 }}>
                      <Typography variant="subtitle2">{n.name} ({n.role})</Typography>
                      <Typography variant="caption">CPU: {Math.round(n.cpuUsed/n.cpuCapacity*100)}% • MEM: {Math.round(n.memUsed/n.memCapacity*100)}%</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Section>
          </Grid>
        </Grid>
      </Box>

      <Dialog open={connectOpen} onClose={()=>setConnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect Kubernetes Cluster</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select SelectProps={{ native:true }} label="Provider" value={form.provider} onChange={(e)=>setForm(f=>({ ...f, provider: e.target.value }))}>
              <option value="aws">AWS (EKS)</option>
              <option value="azure">Azure (AKS)</option>
              <option value="gcp">GCP (GKE)</option>
            </TextField>
            <TextField label="Cluster Name" value={form.name} onChange={(e)=>setForm(f=>({ ...f, name: e.target.value }))} />
            <TextField label="Kubeconfig" value={form.kubeconfig} onChange={(e)=>setForm(f=>({ ...f, kubeconfig: e.target.value }))} multiline minRows={8} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setConnectOpen(false)}>Cancel</Button>
          <Button onClick={async ()=>{
            // Call backend connect
            try {
              const resp = await fetch('/api/k8s/connect', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(form) });
              const json = await resp.json();
              if (json?.success) { setConnectOpen(false); setProvider(form.provider); }
            } catch {}
          }} variant="contained">Connect</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

function ProviderPods({ provider }) {
  const [pods, setPods] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    k8sApi.getPods(provider)
      .then(r => { if (!mounted) return; setPods(r?.data || []); setLoading(false); })
      .catch(() => { if (!mounted) return; setPods([]); setLoading(false); });
    return () => { mounted = false; };
  }, [provider]);
  return (
    <Grid item xs={12} md={4}>
      <Paper sx={{ p:1.5, borderRadius:2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{provider.toUpperCase()} Pods</Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ) : pods.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No pods or not connected</Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 200, overflow: 'auto' }}>
            {pods.slice(0, 30).map(p => (
              <Typography key={`${p.namespace}/${p.name}`} variant="caption">
                {p.namespace}/{p.name} — {p.status} • CPU {p.cpu}% • MEM {p.memory}MB
              </Typography>
            ))}
          </Stack>
        )}
      </Paper>
    </Grid>
  );
}
