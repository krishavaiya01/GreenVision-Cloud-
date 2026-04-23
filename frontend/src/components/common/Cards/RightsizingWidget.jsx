import React, { useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Stack,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress,
  Alert,
  AlertTitle
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SavingsIcon from '@mui/icons-material/Savings';
import SpeedIcon from '@mui/icons-material/Speed';
import CloudIcon from '@mui/icons-material/Cloud';
import { aiApi } from '../../../services/api/aiApi';

const providerOptions = [
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'gcp', label: 'GCP' }
];

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;

const RightsizingWidget = ({ defaultProvider = 'aws' }) => {
  const [provider, setProvider] = useState(defaultProvider);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ instancesAnalyzed: 0, totalEstimatedMonthlySavings: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRightsizing(provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fetchRightsizing = async (prov) => {
    try {
      setLoading(true);
      setError(null);
      const response = await aiApi.getRightsizing(prov);
      if (response?.success) {
        setRows(response.data || []);
        setMeta(response.metadata || meta);
      } else {
        setError(response?.message || 'Failed to load rightsizing data');
      }
    } catch (err) {
      console.error('Rightsizing fetch error:', err);
      setError('Failed to load rightsizing data');
    } finally {
      setLoading(false);
    }
  };

  const totalSavings = meta.totalEstimatedMonthlySavings || 0;
  const instancesAnalyzed = meta.instancesAnalyzed || rows.length;

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudIcon fontSize="small" />
            <Typography variant="h6" fontWeight={700}>Rightsizing Opportunities</Typography>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Select
              size="small"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providerOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => fetchRightsizing(provider)} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      {loading && <LinearProgress />}
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Chip icon={<SavingsIcon />} label={`Est. Monthly Savings: ${currency(totalSavings)}`} color="success" variant="filled" />
          <Chip icon={<SpeedIcon />} label={`Instances Analyzed: ${instancesAnalyzed}`} variant="outlined" />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Unable to load rightsizing data</AlertTitle>
            {error}
          </Alert>
        )}

        {!error && rows.length === 0 && !loading && (
          <Alert severity="info" sx={{ mb: 0 }}>
            <AlertTitle>No opportunities detected</AlertTitle>
            All tracked instances for {provider.toUpperCase()} look right-sized. Keep monitoring utilization trends.
          </Alert>
        )}

        {rows.length > 0 && (
          <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Instance</TableCell>
                <TableCell>Current → Recommended</TableCell>
                <TableCell>Avg CPU</TableCell>
                <TableCell>Avg Memory</TableCell>
                <TableCell align="right">Est. Monthly Savings</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={`${row.instanceId || 'row'}-${idx}`} sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {row.instanceId || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.provider?.toUpperCase() || provider.toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={row.currentType || 'unknown'} size="small" variant="outlined" />
                      <Typography variant="body2" color="text.secondary">→</Typography>
                      <Chip label={row.recommendedType || 'n/a'} size="small" color="primary" variant="filled" />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${Number(row.avgCpuUtilization || 0).toFixed(1)}%`}
                      size="small"
                      color={row.avgCpuUtilization > 85 ? 'warning' : 'success'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.memoryUtilization === null || row.memoryUtilization === undefined ? '—' : `${Number(row.memoryUtilization).toFixed(1)}%`}
                      size="small"
                      color={row.memoryUtilization > 85 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      {currency(row.estimatedMonthlySavings)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.reason || 'Rightsizing suggestion'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default RightsizingWidget;
