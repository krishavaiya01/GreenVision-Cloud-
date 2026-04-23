import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import VerifiedIcon from '@mui/icons-material/Verified';
import { complianceApi } from '../../services/api/complianceApi';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';

export default function ComplianceDashboard() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ action: '', resourceType: '' });
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await complianceApi.getAuditLogs(filters);
      if (res && res.success) {
        // Backend returns { success, data: { logs, totalLogs } }
        const payload = res.data;
        if (payload) {
          setLogs(Array.isArray(payload) ? payload : (payload.logs || []));
        } else {
          setLogs([]);
        }
      }
      else setError(res.message || 'Failed to load logs');
    } catch (err) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await complianceApi.getStatistics();
      if (res && res.success) setStats(res.data);
    } catch (err) {
      // ignore
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await complianceApi.verifyChain();
      setVerifyResult(res.data || res);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    try {
      await complianceApi.exportCSV(filters);
    } catch (err) {
      setError('Export failed');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <DashboardLayout title="Compliance">
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h4">Compliance & Audit Logs</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<VerifiedIcon />} onClick={handleVerify} variant="outlined">
              {verifying ? <CircularProgress size={18} /> : 'Verify Chain'}
            </Button>
            <Button startIcon={<DownloadIcon />} onClick={handleExport} variant="outlined">
              Export CSV
            </Button>
            <IconButton onClick={() => { fetchLogs(); fetchStats(); }}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

      {verifyResult && (
        <Box sx={{ mb: 2 }}>
          {verifyResult.valid ? (
            <Alert severity="success">Chain valid — {verifyResult.logsVerified} logs verified.</Alert>
          ) : (
            <Alert severity="error">Chain invalid — {verifyResult.message || 'issues detected'}</Alert>
          )}
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary">Total Logs</Typography>
              <Typography variant="h5">{stats?.totalLogs ?? '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary">Recent Actions</Typography>
              <Typography variant="h5">{stats?.recentActions ?? '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Action"
            select
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            size="small"
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="CREATE">CREATE</MenuItem>
            <MenuItem value="UPDATE">UPDATE</MenuItem>
            <MenuItem value="DELETE">DELETE</MenuItem>
            <MenuItem value="READ">READ</MenuItem>
          </TextField>

          <TextField
            label="Resource Type"
            select
            value={filters.resourceType}
            onChange={e => setFilters(f => ({ ...f, resourceType: e.target.value }))}
            size="small"
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="CloudMetrics">CloudMetrics</MenuItem>
            <MenuItem value="User">User</MenuItem>
            <MenuItem value="system">system</MenuItem>
          </TextField>
        </Box>

        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource Type</TableCell>
                  <TableCell>Resource ID</TableCell>
                  <TableCell>Hash</TableCell>
                  <TableCell>Prev Hash</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log._id}>
                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{log.userId}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.resourceType}</TableCell>
                    <TableCell>{log.resourceId ?? '—'}</TableCell>
                    <TableCell style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.hash}</TableCell>
                    <TableCell style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.previousHash ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      </Box>
    </DashboardLayout>
  );
}
