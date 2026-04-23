import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  VerifiedUser as VerifiedIcon,
  Warning as WarningIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`
  }
});

const ComplianceDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [chainStatus, setChainStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    status: '',
    limit: 50
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
    fetchStatistics();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.status) params.append('status', filters.status);
      params.append('limit', filters.limit);

      const response = await apiClient.get(`/compliance/audit-logs?${params.toString()}`);
      if (response.data.success) {
        setLogs(response.data.data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await apiClient.get('/compliance/audit-logs/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const verifyChainIntegrity = async () => {
    try {
      setVerifying(true);
      const response = await apiClient.get('/compliance/audit-logs/verify/chain');
      if (response.data.success) {
        setChainStatus(response.data.data);
      }
    } catch (error) {
      console.error('Error verifying chain:', error);
      setChainStatus({ valid: false, message: 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.status) params.append('status', filters.status);

      const response = await apiClient.get(`/compliance/audit-logs/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentChild.removeChild(link);
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getSeverityColor = (status) => {
    switch (status) {
      case 'success': return 'success';
      case 'failure': return 'error';
      case 'partial': return 'warning';
      default: return 'default';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return '#4caf50';
      case 'UPDATE': return '#2196f3';
      case 'DELETE': return '#f44336';
      case 'READ': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        🔐 Compliance & Audit Logs
      </Typography>

      {/* Statistics Cards */}
      {stats && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', rowGap: 2 }}>
          <Card sx={{ flex: 1, minWidth: 150 }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Logs
              </Typography>
              <Typography variant="h5">{stats.totalLogs || 0}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 150, bgcolor: '#e8f5e9' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Success
              </Typography>
              <Typography variant="h5" sx={{ color: '#4caf50' }}>
                {stats.successCount || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 150, bgcolor: '#ffebee' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failures
              </Typography>
              <Typography variant="h5" sx={{ color: '#f44336' }}>
                {stats.failureCount || 0}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Chain Integrity Status */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Chain Integrity Verification"
          action={
            <Button
              variant="contained"
              size="small"
              onClick={verifyChainIntegrity}
              disabled={verifying}
              startIcon={<VerifiedIcon />}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </Button>
          }
        />
        <CardContent>
          {verifying && <LinearProgress />}
          {chainStatus && (
            <Alert severity={chainStatus.valid ? 'success' : 'error'}>
              <AlertTitle>{chainStatus.valid ? '✅ Chain Valid' : '❌ Chain Integrity Issue'}</AlertTitle>
              {chainStatus.message || `${chainStatus.logsVerified} logs verified successfully`}
              {chainStatus.errorAt !== undefined && (
                <Box sx={{ mt: 1 }}>
                  Error detected at log index: {chainStatus.errorAt}
                </Box>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Filters and Export */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Filters" />
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Action</InputLabel>
              <Select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                label="Action"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="CREATE">CREATE</MenuItem>
                <MenuItem value="READ">READ</MenuItem>
                <MenuItem value="UPDATE">UPDATE</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
                <MenuItem value="LOGIN">LOGIN</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Resource Type</InputLabel>
              <Select
                name="resourceType"
                value={filters.resourceType}
                onChange={handleFilterChange}
                label="Resource Type"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="metrics">Metrics</MenuItem>
                <MenuItem value="recommendation">Recommendation</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="settings">Settings</MenuItem>
                <MenuItem value="system">System</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failure">Failure</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Limit"
              type="number"
              name="limit"
              value={filters.limit}
              onChange={handleFilterChange}
              inputProps={{ min: 10, max: 1000 }}
            />

            <Button variant="contained" onClick={fetchAuditLogs} disabled={loading}>
              <RefreshIcon sx={{ mr: 1 }} /> Apply
            </Button>

            <Button variant="outlined" onClick={exportLogs} startIcon={<DownloadIcon />}>
              Export CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader title={`Audit Logs (${logs.length})`} />
        <CardContent>
          {loading && <CircularProgress />}
          {logs.length === 0 && !loading && (
            <Alert severity="info">No audit logs found</Alert>
          )}
          {logs.length > 0 && (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                    <TableCell><strong>Resource</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>IP Address</strong></TableCell>
                    <TableCell><strong>Hash</strong></TableCell>
                    <TableCell><strong>Chain</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log, idx) => (
                    <TableRow
                      key={log._id}
                      onClick={() => {
                        setSelectedLog(log);
                        setDetailsOpen(true);
                      }}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f9f9f9' } }}
                    >
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          sx={{ bgcolor: getActionColor(log.action), color: 'white' }}
                        />
                      </TableCell>
                      <TableCell>
                        {log.resourceType}
                        {log.resourceId && ` (${log.resourceId.substring(0, 8)})`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={log.status === 'success' ? <CheckIcon /> : <WarningIcon />}
                          label={log.status}
                          color={getSeverityColor(log.status)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{log.ipAddress || '—'}</TableCell>
                      <TableCell>
                        <Tooltip title={log.hash}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {log.hash.substring(0, 12)}...
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {log.chainVerified ? (
                          <Chip icon={<CheckIcon />} label="Valid" size="small" color="success" />
                        ) : (
                          <Chip icon={<WarningIcon />} label="Broken" size="small" color="error" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box sx={{ mt: 2 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Timestamp</Typography>
                  <Typography>{new Date(selectedLog.timestamp).toISOString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Action</Typography>
                  <Chip label={selectedLog.action} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Resource</Typography>
                  <Typography>{selectedLog.resourceType} {selectedLog.resourceId && `(${selectedLog.resourceId})`}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Hash</Typography>
                  <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem' }}>
                    {selectedLog.hash}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>Previous Hash</Typography>
                  <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem' }}>
                    {selectedLog.previousHash || 'None (first entry)'}
                  </Typography>
                </Box>
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>Details</Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 1, borderRadius: 1, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </Box>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ComplianceDashboard;
