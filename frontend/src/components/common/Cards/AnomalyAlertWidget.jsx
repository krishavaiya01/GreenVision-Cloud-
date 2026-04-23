// src/components/common/Cards/AnomalyAlertWidget.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Chip,
  Alert,
  AlertTitle,
  Button,
  Stack,
  CircularProgress,
  Badge,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { aiApi } from '../../../services/api/aiApi';

const AnomalyAlertWidget = ({ provider = 'aws', compact = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchActiveAnomalies();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchActiveAnomalies, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAnomalies = async () => {
    try {
      setLoading(true);
      const response = await aiApi.getActiveAnomalies();
      
      if (response.success) {
        setAnomalies(response.data.anomalies || []);
        setError(null);
      } else {
        setError(response.message || 'Failed to fetch anomalies');
      }
    } catch (err) {
      console.error('Error fetching anomalies:', err);
      setError('Failed to load anomalies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (anomalyId) => {
    try {
      const response = await aiApi.dismissAnomaly(anomalyId);
      
      if (response.success) {
        setDismissedIds(prev => new Set([...prev, anomalyId]));
        setAnomalies(prev => prev.filter(a => a._id !== anomalyId));
      }
    } catch (err) {
      console.error('Error dismissing anomaly:', err);
    }
  };

  const handleAcknowledge = async (anomalyId) => {
    try {
      const response = await aiApi.acknowledgeAnomaly(anomalyId);
      
      if (response.success) {
        setAnomalies(prev =>
          prev.map(a => a._id === anomalyId ? { ...a, status: 'acknowledged' } : a)
        );
      }
    } catch (err) {
      console.error('Error acknowledging anomaly:', err);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon sx={{ color: '#d32f2f' }} />;
      case 'high':
        return <ErrorIcon sx={{ color: '#f57c00' }} />;
      case 'medium':
        return <WarningIcon sx={{ color: '#fbc02d' }} />;
      default:
        return <InfoIcon sx={{ color: '#1976d2' }} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getSeverityBgColor = (severity) => {
    const intensity = isDark ? 0.15 : 0.05;
    switch (severity) {
      case 'critical':
        return alpha(theme.palette.error.main, intensity);
      case 'high':
        return alpha(theme.palette.warning.main, intensity);
      case 'medium':
        return alpha(theme.palette.warning.light, intensity);
      default:
        return alpha(theme.palette.info.main, intensity);
    }
  };

  if (loading && anomalies.length === 0) {
    return (
      <Card>
        <CardHeader title="⚠️ Anomaly Alerts" />
        <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={40} />
        </CardContent>
      </Card>
    );
  }

  if (error && anomalies.length === 0) {
    return (
      <Card>
        <CardHeader title="⚠️ Anomaly Alerts" />
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
          <Button
            onClick={fetchActiveAnomalies}
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardHeader
          title="✅ Anomaly Alerts"
          action={
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={fetchActiveAnomalies} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <CardContent>
          <Alert severity="success">
            <AlertTitle>No Active Alerts</AlertTitle>
            Your cloud resources are operating within normal parameters. Keep monitoring for optimal performance.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Count by severity
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>⚠️ Anomaly Alerts</span>
            <Badge badgeContent={anomalies.length} color="error" />
            {criticalCount > 0 && (
              <Chip
                label={`${criticalCount} Critical`}
                color="error"
                size="small"
                variant="outlined"
              />
            )}
            {highCount > 0 && (
              <Chip
                label={`${highCount} High`}
                color="warning"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        }
        action={
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchActiveAnomalies} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent sx={{ maxHeight: compact ? '400px' : '600px', overflowY: 'auto' }}>
        <Stack spacing={2}>
          {anomalies.map((anomaly) => (
            <Box
              key={anomaly._id}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px',
                backgroundColor: getSeverityBgColor(anomaly.severity),
                borderLeft: `4px solid ${
                  anomaly.severity === 'critical'
                    ? '#d32f2f'
                    : anomaly.severity === 'high'
                    ? '#f57c00'
                    : '#fbc02d'
                }`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }
              }}
              onClick={() => setExpandedId(expandedId === anomaly._id ? null : anomaly._id)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                  {getSeverityIcon(anomaly.severity)}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                      <strong>{anomaly.anomalyType.replace(/_/g, ' ').toUpperCase()}</strong>
                      <Chip
                        label={anomaly.severity}
                        size="small"
                        color={getSeverityColor(anomaly.severity)}
                        variant="outlined"
                      />
                    </Box>
                    <Box sx={{ fontSize: '0.9rem', color: 'text.secondary', mb: 1 }}>
                      {anomaly.description}
                    </Box>

                    {/* Expanded details */}
                    {expandedId === anomaly._id && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider', fontSize: '0.85rem' }}>
                        <Box sx={{ mb: 1 }}>
                          <strong>Metric:</strong> {anomaly.metricName}
                        </Box>
                        <Box sx={{ mb: 1 }}>
                          <strong>Normal Value:</strong> {anomaly.normalValue.toFixed(2)} | <strong>Anomalous Value:</strong> {anomaly.anomalousValue.toFixed(2)}
                        </Box>
                        {anomaly.percentageIncrease !== 0 && (
                          <Box sx={{ mb: 1, color: '#d32f2f' }}>
                            <strong>Increase:</strong> {anomaly.percentageIncrease.toFixed(1)}%
                          </Box>
                        )}
                        {anomaly.zScore !== 0 && (
                          <Box sx={{ mb: 1 }}>
                            <strong>Z-Score:</strong> {anomaly.zScore.toFixed(2)}
                          </Box>
                        )}
                        {anomaly.recommendation && (
                          <Box sx={{ mt: 1, p: 1, backgroundColor: 'action.hover', borderRadius: '4px' }}>
                            <strong>💡 Recommendation:</strong> {anomaly.recommendation}
                          </Box>
                        )}
                        {anomaly.estimatedCostImpact > 0 && (
                          <Box sx={{ mt: 1, color: '#d32f2f' }}>
                            <strong>💰 Cost Impact:</strong> ${anomaly.estimatedCostImpact.toFixed(2)}
                          </Box>
                        )}
                        {anomaly.resourceId && (
                          <Box sx={{ mt: 1 }}>
                            <strong>Resource ID:</strong> {anomaly.resourceId}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Action buttons */}
                <Stack direction="row" spacing={0.5}>
                  {anomaly.status !== 'acknowledged' && (
                    <Tooltip title="Acknowledge this alert">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(anomaly._id);
                        }}
                      >
                        ACK
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip title="Dismiss this alert">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(anomaly._id);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                {new Date(anomaly.detectedAt).toLocaleString()}
              </Box>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default AnomalyAlertWidget;
