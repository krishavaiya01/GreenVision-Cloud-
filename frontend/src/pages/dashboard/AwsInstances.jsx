// src/pages/dashboard/AwsInstances.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  TablePagination,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  CircularProgress,
  Divider
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudIcon from '@mui/icons-material/Cloud';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import apiClient from '../../services/api/apiClient';
import { connectSocket, getSocket } from '../../services/realtime/socketClient';

export default function AwsInstances() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [ingestPulse, setIngestPulse] = useState(false);

  // Fetch paginated instances
  const fetchInstances = async (newPage = page, newLimit = rowsPerPage) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/cloud/aws/instances?page=${newPage + 1}&limit=${newLimit}`);
      if (res.data?.success) {
        setRows(res.data.data.instances || []);
        setTotal(res.data.data.totalInstances || 0);
        setLastUpdated(res.data.data.capturedAt || new Date().toISOString());
      }
    } catch (e) {
      console.error('Failed to fetch AWS instances:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription: we listen for cloud:aws:instances events to refetch
  useEffect(() => {
    const sock = connectSocket(() => localStorage.getItem('token') || sessionStorage.getItem('token'));

    function onConnect() { setRealtimeConnected(true); }
    function onDisconnect() { setRealtimeConnected(false); }
    async function onAwsIngest(evt) {
      if (evt?.type === 'ingest') {
        setIngestPulse(true);
        setTimeout(() => setIngestPulse(false), 600);
        // Refresh current page silently
        fetchInstances(page, rowsPerPage);
      }
    }

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('cloud:aws:instances', onAwsIngest);

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('cloud:aws:instances', onAwsIngest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);

  useEffect(() => { fetchInstances(); }, []); // initial

  const handleChangePage = (_e, newPage) => {
    setPage(newPage);
    fetchInstances(newPage, rowsPerPage);
  };

  const handleChangeRowsPerPage = (e) => {
    const val = parseInt(e.target.value, 10);
    setRowsPerPage(val);
    setPage(0);
    fetchInstances(0, val);
  };

  const avgCPUOverall = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, r) => s + (r.avgCPU || 0), 0) / rows.length * 10) / 10;
  }, [rows]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <CloudIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>AWS Instances</Typography>
        {realtimeConnected && <Chip size="small" color="success" label="Realtime" />}
        {ingestPulse && <Chip size="small" color="info" label="Updated" />}
        <Box flexGrow={1} />
        <Tooltip title="Refresh">
          <IconButton onClick={() => fetchInstances()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider flexItem orientation="vertical" />}> 
          <Box>
            <Typography variant="body2" color="text.secondary">Total Instances</Typography>
            <Typography variant="h6">{total}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Avg CPU</Typography>
            <Typography variant="h6">{avgCPUOverall}%</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Last Updated</Typography>
            <Typography variant="h6" fontSize={14}>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instance ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Avg CPU %</TableCell>
                <TableCell align="right">Net In</TableCell>
                <TableCell align="right">Net Out</TableCell>
                <TableCell align="right">Disk Read</TableCell>
                <TableCell align="right">Disk Write</TableCell>
                <TableCell align="right">Samples</TableCell>
                <TableCell>Region</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" mt={2}>Loading instances...</Typography>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">No instances found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.instanceType}</TableCell>
                    <TableCell align="right">{r.avgCPU}</TableCell>
                    <TableCell align="right">{r.networkIn}</TableCell>
                    <TableCell align="right">{r.networkOut}</TableCell>
                    <TableCell align="right">{r.diskRead}</TableCell>
                    <TableCell align="right">{r.diskWrite}</TableCell>
                    <TableCell align="right">{r.sampleCount}</TableCell>
                    <TableCell>{r.region}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5,10,20,50]}
            labelRowsPerPage="Rows"
        />
      </Paper>
    </Box>
  );
}
