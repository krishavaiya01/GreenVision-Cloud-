import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Chip,
  Stack,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
  Button,
  Link,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { cloudAzureApi } from "../../../services/api/cloudAzureApi";
import { cloudMetricApi } from "../../../services/api/cloudMetricApi";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend);

const LEVEL_OPTIONS = [
  { label: "All", value: "" },
  { label: "Error", value: "error" },
  { label: "Warn", value: "warn" },
  { label: "Informational", value: "informational" },
];

export default function AzureResources() {
  const [logs, setLogs] = useState([]);
  const [summaryData, setSummaryData] = useState({ counts: { total: 0, error: 0, warn: 0, info: 0 }, carbon: { kgCO2: 0, cost: 0 } });
  const [mode, setMode] = useState('all'); // 'all' | 'issues'
  const [loading, setLoading] = useState(true);
  const [resLoading, setResLoading] = useState(true);
  const [costSeries, setCostSeries] = useState(null);
  const [costLoading, setCostLoading] = useState(true);
  const [error, setError] = useState("");
  const [resError, setResError] = useState("");
  const [resourceGroups, setResourceGroups] = useState([]);
  const [webApps, setWebApps] = useState([]);
  const [appServicePlans, setAppServicePlans] = useState([]);
  const [storageAccounts, setStorageAccounts] = useState([]);
  const [counts, setCounts] = useState({ resourceGroups: 0, webApps: 0, appServicePlans: 0, storageAccounts: 0 });
  const [filters, setFilters] = useState({
    sinceMinutes: 180,
    level: "",
    search: "",
    limit: 200,
  });

  // Resource table UX state
  const [searchRG, setSearchRG] = useState("");
  const [searchWeb, setSearchWeb] = useState("");
  const [searchPlan, setSearchPlan] = useState("");
  const [searchSA, setSearchSA] = useState("");

  const [sortRG, setSortRG] = useState({ field: "name", direction: "asc" });
  const [sortWeb, setSortWeb] = useState({ field: "name", direction: "asc" });
  const [sortPlan, setSortPlan] = useState({ field: "name", direction: "asc" });
  const [sortSA, setSortSA] = useState({ field: "name", direction: "asc" });

  const [pageRG, setPageRG] = useState(0);
  const [pageWeb, setPageWeb] = useState(0);
  const [pagePlan, setPagePlan] = useState(0);
  const [pageSA, setPageSA] = useState(0);

  const [rowsRG, setRowsRG] = useState(10);
  const [rowsWeb, setRowsWeb] = useState(10);
  const [rowsPlan, setRowsPlan] = useState(10);
  const [rowsSA, setRowsSA] = useState(10);

  const summary = useMemo(() => {
    const counts = { total: logs.length, error: 0, warn: 0, info: 0 };
    logs.forEach((l) => {
      const lvl = String(l.level || l.Level || "").toLowerCase();
      if (lvl === "error") counts.error += 1;
      else if (lvl === "warn" || lvl === "warning") counts.warn += 1;
      else counts.info += 1;
    });
    return counts;
  }, [logs]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let arr = [];
      if (mode === 'issues') {
        const { data } = await cloudAzureApi.getIssueLogs({
          sinceMinutes: filters.sinceMinutes,
          level: filters.level,
          search: filters.search,
          limit: filters.limit,
        });
        arr = Array.isArray(data) ? data : data?.data || data?.logs || [];
      }
      // Also fetch summary for CO2/cost via axios client (handles auth + baseURL)
      const sum = await cloudAzureApi.getSummary({ sinceMinutes: filters.sinceMinutes });
      if (sum?.data?.success) {
        setSummaryData(sum.data.data);
        const recent = sum.data.data?.recent || [];
        // For 'all' mode, or if there are no issue logs, show normalized recent logs
        if (mode === 'all' || (!arr || arr.length === 0)) setLogs(Array.isArray(recent) ? recent : []);
      }
      // Second fallback: live KQL sample from diag if still empty
      if ((!arr || arr.length === 0) && (!summaryData?.recent || (summaryData?.recent || []).length === 0)) {
        try {
          const diag = await cloudAzureApi.diag();
          const sample = diag?.data?.data?.sample || [];
          if (Array.isArray(sample) && sample.length) setLogs(sample);
        } catch (_) {}
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load Azure logs");
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    setResLoading(true);
    setResError("");
    try {
      const resp = await cloudAzureApi.getResources();
      const data = resp?.data?.data || {};
      setResourceGroups(Array.isArray(data.resourceGroups) ? data.resourceGroups : []);
      setWebApps(Array.isArray(data.webApps) ? data.webApps : []);
      setAppServicePlans(Array.isArray(data.appServicePlans) ? data.appServicePlans : []);
      setStorageAccounts(Array.isArray(data.storageAccounts) ? data.storageAccounts : []);
      if (data.counts) setCounts(data.counts);
      if (data?.errors?.resourceGroups || data?.errors?.webApps) {
        setResError([data?.errors?.resourceGroups, data?.errors?.webApps].filter(Boolean).join("; "));
      }
    } catch (e) {
      setResError(e?.response?.data?.message || e?.message || "Failed to load Azure resources");
    } finally {
      setResLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadResources();
    (async () => {
      try {
        setCostLoading(true);
        const res = await cloudMetricApi.getCostSeries({ sinceHours: 12 });
        setCostSeries(res?.data || res);
      } catch (e) {
        setCostSeries(null);
      } finally {
        setCostLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => load();
  const switchToAll = () => { setMode('all'); setTimeout(load, 0); };
  const switchToIssues = () => { setMode('issues'); setTimeout(load, 0); };

  // Utilities
  const compare = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
  const sortBy = (list, { field, direction }) => {
    const dir = direction === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      const av = (a?.[field] ?? (a?.properties?.[field] ?? ""));
      const bv = (b?.[field] ?? (b?.properties?.[field] ?? ""));
      return compare(String(av).toLowerCase(), String(bv).toLowerCase()) * dir;
    });
  };

  const toCSV = (rows, headers) => {
    const head = headers.map(h => '"' + h.label.replace(/"/g, '""') + '"').join(",");
    const body = rows.map(r => headers.map(h => {
      const val = h.get(r);
      const s = val == null ? "" : String(val);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(",")).join("\n");
    return head + "\n" + body;
  };
  const download = (filename, content) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived resources: filter + sort + paginate
  const rgFiltered = useMemo(() => {
    const q = searchRG.trim().toLowerCase();
    const f = q ? resourceGroups.filter(r => (r.name || "").toLowerCase().includes(q) || (r.location || "").toLowerCase().includes(q)) : resourceGroups;
    const s = sortBy(f, sortRG);
    const start = pageRG * rowsRG;
    return { total: s.length, page: s.slice(start, start + rowsRG) };
  }, [resourceGroups, searchRG, sortRG, pageRG, rowsRG]);

  const webSummary = useMemo(() => {
    const counts = { running: 0, stopped: 0 };
    webApps.forEach(w => { if ((w.state || '').toLowerCase() === 'running') counts.running += 1; else counts.stopped += 1; });
    return counts;
  }, [webApps]);

  const azureCostChart = useMemo(() => {
    const provider = (costSeries?.providers || []).find(p => p.provider === 'azure');
    const pts = provider?.series || [];
    const anomalies = provider?.anomalies || [];
    const iso = pts.map(p => new Date(p.t).toISOString());
    const labels = iso.map(ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const anomalyIso = new Set(anomalies.map(a => new Date(a.t).toISOString()));
    const latest = pts.length ? pts[pts.length - 1].cost || 0 : 0;
    const max = pts.reduce((m, p) => Math.max(m, p.cost || 0), 0);
    return {
      data: {
        labels,
        datasets: [{
          label: 'Azure Cost (USD)',
          data: pts.map(p => p.cost || 0),
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37,99,235,0.18)',
          fill: true,
          tension: 0.25,
          pointRadius: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? 5 : 2,
          pointBackgroundColor: (ctx) => anomalyIso.has(iso[ctx.dataIndex]) ? '#EF4444' : '#2563EB',
        }]
      },
      anomalies,
      stats: { latest, max, spikeCount: anomalies.length }
    };
  }, [costSeries]);

  const webFiltered = useMemo(() => {
    const q = searchWeb.trim().toLowerCase();
    const base = q ? webApps.filter(w => (w.name || "").toLowerCase().includes(q) || (w.resourceGroup || "").toLowerCase().includes(q) || (w.location || "").toLowerCase().includes(q)) : webApps;
    const s = sortBy(base, sortWeb);
    const start = pageWeb * rowsWeb;
    return { total: s.length, page: s.slice(start, start + rowsWeb) };
  }, [webApps, searchWeb, sortWeb, pageWeb, rowsWeb]);

  const planFiltered = useMemo(() => {
    const q = searchPlan.trim().toLowerCase();
    const base = q ? appServicePlans.filter(p => (p.name || "").toLowerCase().includes(q) || (p.resourceGroup || "").toLowerCase().includes(q) || (p.location || "").toLowerCase().includes(q) || (p?.sku?.name || "").toLowerCase().includes(q)) : appServicePlans;
    const s = sortBy(base, sortPlan);
    const start = pagePlan * rowsPlan;
    return { total: s.length, page: s.slice(start, start + rowsPlan) };
  }, [appServicePlans, searchPlan, sortPlan, pagePlan, rowsPlan]);

  const saFiltered = useMemo(() => {
    const q = searchSA.trim().toLowerCase();
    const base = q ? storageAccounts.filter(sa => (sa.name || "").toLowerCase().includes(q) || (sa.resourceGroup || "").toLowerCase().includes(q) || (sa.location || "").toLowerCase().includes(q) || (sa?.sku?.name || "").toLowerCase().includes(q)) : storageAccounts;
    const s = sortBy(base, sortSA);
    const start = pageSA * rowsSA;
    return { total: s.length, page: s.slice(start, start + rowsSA) };
  }, [storageAccounts, searchSA, sortSA, pageSA, rowsSA]);

  // Export helpers
  const exportRG = () => {
    const headers = [
      { label: "Name", get: r => r.name },
      { label: "Location", get: r => r.location },
      { label: "Provisioning", get: r => r?.properties?.provisioningState || '-' },
      { label: "Tags", get: r => Object.entries(r.tags || {}).map(([k,v]) => `${k}:${v}`).join("; ") }
    ];
    download(`azure-resource-groups.csv`, toCSV(resourceGroups, headers));
  };
  const exportWeb = () => {
    const headers = [
      { label: "Name", get: r => r.name },
      { label: "Resource Group", get: r => r.resourceGroup || '-' },
      { label: "Location", get: r => r.location },
      { label: "State", get: r => r.state },
      { label: "Host", get: r => r.defaultHostName || (r.enabledHostNames?.[0] || '') },
    ];
    download(`azure-web-apps.csv`, toCSV(webApps, headers));
  };
  const exportPlans = () => {
    const headers = [
      { label: "Name", get: r => r.name },
      { label: "Resource Group", get: r => r.resourceGroup || '-' },
      { label: "Location", get: r => r.location },
      { label: "SKU", get: r => r.sku ? `${r.sku.tier || ''} ${r.sku.name || ''}`.trim() : '-' },
      { label: "Capacity", get: r => r.sku?.capacity ?? '' },
    ];
    download(`azure-app-service-plans.csv`, toCSV(appServicePlans, headers));
  };
  const exportSA = () => {
    const headers = [
      { label: "Name", get: r => r.name },
      { label: "Resource Group", get: r => r.resourceGroup || '-' },
      { label: "Location", get: r => r.location },
      { label: "SKU", get: r => r.sku ? `${r.sku.tier || ''} ${r.sku.name || ''}`.trim() : '-' },
      { label: "HTTPS Only", get: r => r.enableHttpsTrafficOnly ? 'Yes' : 'No' },
    ];
    download(`azure-storage-accounts.csv`, toCSV(storageAccounts, headers));
  };
  const exportLogs = () => {
    const headers = [
      { label: "Time", get: r => r.time || r.TimeGenerated || '' },
      { label: "Level", get: r => r.level || r.Level || '' },
      { label: "Operation", get: r => r.operation || r.OperationName || '' },
      { label: "Message", get: r => r.message || r.ResultDescription || r.Message || '' },
      { label: "ResourceId", get: r => r.resourceId || r._ResourceId || r.ResourceId || '' },
    ];
    download(`azure-logs.csv`, toCSV(logs, headers));
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">Azure Resources</Typography>
        <Box>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => { load(); loadResources(); }} disabled={loading || resLoading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export logs CSV">
            <span>
              <IconButton onClick={exportLogs} disabled={loading || logs.length === 0}>
                <FilterAltIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="All logs">
            <span>
              <IconButton onClick={switchToAll} color={mode === 'all' ? 'primary' : 'default'}>
                <ListAltIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Issues only">
            <span>
              <IconButton onClick={switchToIssues} color={mode === 'issues' ? 'primary' : 'default'}>
                <ReportProblemIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Azure Cost (last 12h)</Typography>
        <Box sx={{ height: 240 }}>
          {costLoading ? (
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}><CircularProgress size={20} /></Box>
          ) : azureCostChart.data?.datasets?.[0]?.data?.length ? (
            <Line
              data={azureCostChart.data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => {
                    const cost = Number(ctx.parsed.y || 0);
                    const ts = azureCostChart.data.labels?.[ctx.dataIndex];
                    const anomaly = (azureCostChart.anomalies || []).find(a => new Date(a.t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) === ts);
                    const sev = anomaly ? ` • spike +${anomaly.severity || 0}%` : '';
                    return `$${cost.toFixed(2)}${sev}`;
                  } } }
                },
                scales: { y: { title: { display: true, text: 'USD' } }, x: { grid: { display: false } } }
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">No recent Azure cost points.</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap:'wrap' }}>
          {(azureCostChart.anomalies || []).map((a) => (
            <Chip key={a.t} size="small" color="error" label={`Spike ${new Date(a.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • $${Number(a.cost || a.latestCost || 0).toFixed(2)}`} />
          ))}
          {(azureCostChart.anomalies || []).length === 0 && <Chip size="small" label="No spikes" />}
          <Chip size="small" color="primary" label={`Latest: $${Number(azureCostChart.stats?.latest || 0).toFixed(2)}`} />
          <Chip size="small" label={`Max: $${Number(azureCostChart.stats?.max || 0).toFixed(2)}`} />
          <Chip size="small" label={`Spikes: ${azureCostChart.stats?.spikeCount || 0}`} />
        </Stack>
      </Paper>

      {/* Resource inventory section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip color="primary" label={`Resource Groups: ${counts.resourceGroups}`} />
          <Chip color="primary" label={`Web Apps: ${counts.webApps}`} />
          <Chip color="primary" label={`App Service Plans: ${counts.appServicePlans}`} />
          <Chip color="primary" label={`Storage Accounts: ${counts.storageAccounts}`} />
          <Chip color="success" label={`Running Apps: ${webSummary.running}`} />
          <Chip color="warning" label={`Stopped Apps: ${webSummary.stopped}`} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Resource Groups</Typography>
          <TextField size="small" placeholder="Search RG by name/location" value={searchRG} onChange={(e) => { setSearchRG(e.target.value); setPageRG(0); }} />
          <Button size="small" variant="outlined" onClick={exportRG} disabled={resourceGroups.length === 0}>Export CSV</Button>
        </Stack>
        {resLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : resError ? (
          <Typography color="warning.main">{resError}</Typography>
        ) : resourceGroups.length === 0 ? (
          <Typography>No resource groups found for this subscription.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortRG.field === 'name' ? sortRG.direction : false}>
                    <TableSortLabel active={sortRG.field === 'name'} direction={sortRG.direction} onClick={() => setSortRG(s => ({ field: 'name', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Name</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortRG.field === 'location' ? sortRG.direction : false}>
                    <TableSortLabel active={sortRG.field === 'location'} direction={sortRG.direction} onClick={() => setSortRG(s => ({ field: 'location', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Location</TableSortLabel>
                  </TableCell>
                  <TableCell>Provisioning</TableCell>
                  <TableCell>Tags</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rgFiltered.page.map((rg) => (
                  <TableRow key={rg.id}>
                    <TableCell>
                      <Link href={`https://portal.azure.com/#@/resource${rg.id}`} target="_blank" rel="noopener">
                        {rg.name}
                      </Link>
                    </TableCell>
                    <TableCell>{rg.location}</TableCell>
                    <TableCell>{rg?.properties?.provisioningState || '-'}</TableCell>
                    <TableCell>
                      {Object.keys(rg.tags || {}).length === 0 ? '-' : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {Object.entries(rg.tags).slice(0, 4).map(([k, v]) => (
                            <Chip key={k} size="small" label={`${k}:${v}`} />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={rgFiltered.total}
              page={pageRG}
              onPageChange={(_, p) => setPageRG(p)}
              rowsPerPage={rowsRG}
              onRowsPerPageChange={(e) => { setRowsRG(parseInt(e.target.value, 10)); setPageRG(0); }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Web Apps</Typography>
          <TextField size="small" placeholder="Search by name/RG/location" value={searchWeb} onChange={(e) => { setSearchWeb(e.target.value); setPageWeb(0); }} />
          <Button size="small" variant="outlined" onClick={exportWeb} disabled={webApps.length === 0}>Export CSV</Button>
        </Stack>
        {resLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : webApps.length === 0 ? (
          <Typography>No Web Apps found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortWeb.field === 'name' ? sortWeb.direction : false}>
                    <TableSortLabel active={sortWeb.field === 'name'} direction={sortWeb.direction} onClick={() => setSortWeb(s => ({ field: 'name', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Name</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortWeb.field === 'resourceGroup' ? sortWeb.direction : false}>
                    <TableSortLabel active={sortWeb.field === 'resourceGroup'} direction={sortWeb.direction} onClick={() => setSortWeb(s => ({ field: 'resourceGroup', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Resource Group</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortWeb.field === 'location' ? sortWeb.direction : false}>
                    <TableSortLabel active={sortWeb.field === 'location'} direction={sortWeb.direction} onClick={() => setSortWeb(s => ({ field: 'location', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Location</TableSortLabel>
                  </TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Host</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webFiltered.page.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link href={`https://portal.azure.com/#@/resource${app.id}`} target="_blank" rel="noopener">
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell>{app.resourceGroup || '-'}</TableCell>
                    <TableCell>{app.location}</TableCell>
                    <TableCell>
                      <Chip size="small" color={app.state === 'Running' ? 'success' : 'default'} label={app.state || '-'} />
                    </TableCell>
                    <TableCell title={app.defaultHostName || ''} style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {app.defaultHostName || (app.enabledHostNames?.[0] || '-')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={webFiltered.total}
              page={pageWeb}
              onPageChange={(_, p) => setPageWeb(p)}
              rowsPerPage={rowsWeb}
              onRowsPerPageChange={(e) => { setRowsWeb(parseInt(e.target.value, 10)); setPageWeb(0); }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>App Service Plans</Typography>
          <TextField size="small" placeholder="Search by name/RG/location/SKU" value={searchPlan} onChange={(e) => { setSearchPlan(e.target.value); setPagePlan(0); }} />
          <Button size="small" variant="outlined" onClick={exportPlans} disabled={appServicePlans.length === 0}>Export CSV</Button>
        </Stack>
        {resLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : appServicePlans.length === 0 ? (
          <Typography>No App Service Plans found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortPlan.field === 'name' ? sortPlan.direction : false}>
                    <TableSortLabel active={sortPlan.field === 'name'} direction={sortPlan.direction} onClick={() => setSortPlan(s => ({ field: 'name', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Name</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortPlan.field === 'resourceGroup' ? sortPlan.direction : false}>
                    <TableSortLabel active={sortPlan.field === 'resourceGroup'} direction={sortPlan.direction} onClick={() => setSortPlan(s => ({ field: 'resourceGroup', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Resource Group</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortPlan.field === 'location' ? sortPlan.direction : false}>
                    <TableSortLabel active={sortPlan.field === 'location'} direction={sortPlan.direction} onClick={() => setSortPlan(s => ({ field: 'location', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Location</TableSortLabel>
                  </TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell sortDirection={sortPlan.field === 'capacity' ? sortPlan.direction : false}>
                    <TableSortLabel active={sortPlan.field === 'capacity'} direction={sortPlan.direction} onClick={() => setSortPlan(s => ({ field: 'capacity', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Capacity</TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {planFiltered.page.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <Link href={`https://portal.azure.com/#@/resource${plan.id}`} target="_blank" rel="noopener">
                        {plan.name}
                      </Link>
                    </TableCell>
                    <TableCell>{plan.resourceGroup || '-'}</TableCell>
                    <TableCell>{plan.location}</TableCell>
                    <TableCell>{plan.sku ? `${plan.sku.tier || ''} ${plan.sku.name || ''}`.trim() : '-'}</TableCell>
                    <TableCell>{plan.sku?.capacity ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={planFiltered.total}
              page={pagePlan}
              onPageChange={(_, p) => setPagePlan(p)}
              rowsPerPage={rowsPlan}
              onRowsPerPageChange={(e) => { setRowsPlan(parseInt(e.target.value, 10)); setPagePlan(0); }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Storage Accounts</Typography>
          <TextField size="small" placeholder="Search by name/RG/location/SKU" value={searchSA} onChange={(e) => { setSearchSA(e.target.value); setPageSA(0); }} />
          <Button size="small" variant="outlined" onClick={exportSA} disabled={storageAccounts.length === 0}>Export CSV</Button>
        </Stack>
        {resLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : storageAccounts.length === 0 ? (
          <Typography>No Storage Accounts found.</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortSA.field === 'name' ? sortSA.direction : false}>
                    <TableSortLabel active={sortSA.field === 'name'} direction={sortSA.direction} onClick={() => setSortSA(s => ({ field: 'name', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Name</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortSA.field === 'resourceGroup' ? sortSA.direction : false}>
                    <TableSortLabel active={sortSA.field === 'resourceGroup'} direction={sortSA.direction} onClick={() => setSortSA(s => ({ field: 'resourceGroup', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Resource Group</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortSA.field === 'location' ? sortSA.direction : false}>
                    <TableSortLabel active={sortSA.field === 'location'} direction={sortSA.direction} onClick={() => setSortSA(s => ({ field: 'location', direction: s.direction === 'asc' ? 'desc' : 'asc' }))}>Location</TableSortLabel>
                  </TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>HTTPS only</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {saFiltered.page.map((sa) => (
                  <TableRow key={sa.id}>
                    <TableCell>
                      <Link href={`https://portal.azure.com/#@/resource${sa.id}`} target="_blank" rel="noopener">
                        {sa.name}
                      </Link>
                    </TableCell>
                    <TableCell>{sa.resourceGroup || '-'}</TableCell>
                    <TableCell>{sa.location}</TableCell>
                    <TableCell>{sa.sku ? `${sa.sku.tier || ''} ${sa.sku.name || ''}`.trim() : '-'}</TableCell>
                    <TableCell>{sa.enableHttpsTrafficOnly ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={saFiltered.total}
              page={pageSA}
              onPageChange={(_, p) => setPageSA(p)}
              rowsPerPage={rowsSA}
              onRowsPerPageChange={(e) => { setRowsSA(parseInt(e.target.value, 10)); setPageSA(0); }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            select
            size="small"
            label="Level"
            value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            {LEVEL_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Since (minutes)"
            value={filters.sinceMinutes}
            onChange={(e) => setFilters((f) => ({ ...f, sinceMinutes: Math.max(1, Number(e.target.value || 60)) }))}
            sx={{ width: 180 }}
          />
          <TextField
            size="small"
            label="Search message"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            sx={{ flex: 1, minWidth: 220 }}
          />
          <Button startIcon={<FilterAltIcon />} variant="contained" onClick={handleApply} disabled={loading}>
            Apply
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1}>
          <Chip label={`Total ${summary.total}`} />
          <Chip color="error" label={`Errors ${summary.error}`} />
          <Chip color="warning" label={`Warnings ${summary.warn}`} />
          <Chip color="info" label={`Info ${summary.info}`} />
          <Chip label={`CO2 ${Number(summaryData.carbon?.kgCO2 || 0).toFixed(4)} kg`} />
          <Chip label={`Cost $${Number(summaryData.carbon?.cost || 0).toFixed(4)}`} />
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : logs.length === 0 ? (
        <Typography>No Azure logs in the selected window.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Operation</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Resource</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((row, idx) => {
                const time = row.time || row.TimeGenerated;
                const level = (row.level || row.Level || "").toString();
                const op = row.operation || row.OperationName || "";
                const msg = row.message || row.ResultDescription || row.Message || "";
                const rid = row.resourceId || row._ResourceId || row.ResourceId || "";
                return (
                  <TableRow key={row.eventId || `${time}-${idx}`}>
                    <TableCell>{time ? new Date(time).toLocaleString() : "-"}</TableCell>
                    <TableCell>{level}</TableCell>
                    <TableCell>{op}</TableCell>
                    <TableCell style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={msg}>
                      {msg}
                    </TableCell>
                    <TableCell style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={rid}>
                      {rid}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

