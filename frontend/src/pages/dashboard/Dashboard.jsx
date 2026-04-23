import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { aiApi } from '../../services/api/aiApi';
import { cloudApi } from '../../services/api/cloudApi';
import {
  Grid,
  Typography,
  Box,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Skeleton
} from '@mui/material';
import {
  Cloud,
  Psychology,
  TrendingUp,
  Refresh,
  GetApp,
  Notifications,
  Speed,
  Storage,
  Memory,
  NetworkCheck
} from '@mui/icons-material';
// ✅ Fix: Eco ko alag se import karo
import ForestIcon from '@mui/icons-material/Forest';

import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/common/Layout/DashboardLayout';
import MetricCard from '../../components/common/Cards/MetricCard';
import LineChart from '../../components/common/Charts/LineChart';
import AnomalyAlertWidget from '../../components/common/Cards/AnomalyAlertWidget';
import RightsizingWidget from '../../components/common/Cards/RightsizingWidget';
import { colors } from '../../styles/theme/colors';
import CloudMonitoring from './CloudMonitoring';
import AwsResources from './cloud-monitoring/AwsResources';
import AzureResources from './cloud-monitoring/AzureResources';
import GcpResources from './cloud-monitoring/GcpResources';
import AIRecommendations from './AIRecommendations';
// MultiCloudIssueLogsCard moved to dedicated Multi-Cloud Manager page

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5 }
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    overview: {
      totalCost: 0,
      totalEmissions: 0,
      avgCPUUsage: 0,
      activeInstances: 0,
      efficiencyScore: 0,
      providers: []
    },
    trends: {
      costs: [],
      emissions: []
    }
  });

  const [recommendationCount, setRecommendationCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    aiApi.getRecommendations()
      .then((data) => {
        setRecommendationCount(data?.data?.totalRecommendations || 0);
      })
      .catch(() => setRecommendationCount(0));
  }, []);


  // Real data for charts (from backend trends)
  const usageChartData = {
    labels: dashboardData.trends.costs.map(item => item.date),
    datasets: [
      {
        label: 'Total Cost',
        data: dashboardData.trends.costs.map(item => item.value),
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[100],
        fill: true,
        tension: 0.4
      },
      {
        label: 'Total Emissions',
        data: dashboardData.trends.emissions.map(item => item.value),
        borderColor: colors.status.excellent.main,
        backgroundColor: colors.status.excellent.light,
        fill: true,
        tension: 0.4
      }
    ]
  };


  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await cloudApi.getDashboard();
        if (res.success && res.data) {
          setDashboardData(res.data);
        }
      } catch (e) {
        // Optionally show error
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };



  return (
    <DashboardLayout title="Overview Dashboard" loading={loading}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {/* Header Section */}
        <motion.div variants={itemVariants}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 800,
                    background: colors.gradients.primary,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1
                  }}
                >
                  {getGreeting()}, {user?.name || 'User'}! 👋
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Here's your cloud environmental impact overview
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Tooltip title="Refresh Data">
                  <span>
                    <IconButton 
                      onClick={handleRefresh}
                      disabled={refreshing}
                      sx={{
                        bgcolor: 'background.paper',
                        boxShadow: 1,
                        '&:hover': { boxShadow: 2 }
                      }}
                    >
                      <Refresh sx={{ 
                        animation: refreshing ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }} />
                    </IconButton>
                  </span>
                </Tooltip>

                <Button
                  variant="contained"
                  startIcon={<GetApp />}
                  sx={{
                    background: colors.gradients.primary,
                    boxShadow: `0 4px 14px ${colors.primary[500]}30`
                  }}
                >
                  Export Report
                </Button>
              </Box>
            </Box>

            {/* Status Chips */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<Cloud />}
                label="3 Providers Connected"
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<ForestIcon />}
                label="Carbon Negative This Month"
                sx={{ 
                  bgcolor: colors.status.excellent.bg,
                  color: colors.status.excellent.dark,
                  borderColor: colors.status.excellent.main,
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/dashboard/carbon-tracking')}
              />
              <Chip
                icon={<Psychology />}
                label={`${recommendationCount} New Recommendations`}
                sx={{ 
                  bgcolor: colors.status.moderate.bg,
                  color: colors.status.moderate.dark,
                  cursor: 'pointer'
                }}
                onClick={() => navigate('/ai-recommendations')}
              />
              {(dashboardData.overview.providers || []).map(p => (
                <Chip key={p.provider}
                  icon={<Cloud />}
                  label={`${p.provider.toUpperCase()}: ${p.kgCO2} kg CO₂, $${p.cost}`}
                  sx={{ bgcolor: '#eef7ff' }}
                />
              ))}
            </Box>
          </Box>
        </motion.div>

        {/* Overview Metrics */}
        <motion.div variants={itemVariants}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Cost"
                value={dashboardData.overview.totalCost}
                unit={"$"}
                icon={TrendingUp}
                color={colors.status.moderate.main}
                variant="outlined"
                loading={loading}
                subtitle="Total spending"
                progress={60}
                progressLabel="Budget utilization"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Emissions"
                value={dashboardData.overview.totalEmissions}
                unit={"kg CO₂"}
                icon={ForestIcon}
                color={colors.status.critical.main}
                variant="gradient"
                loading={loading}
                subtitle="Environmental impact"
                badgeColor={colors.status.excellent.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Avg CPU Usage"
                value={dashboardData.overview.avgCPUUsage}
                unit={"%"}
                icon={Memory}
                color={colors.primary[500]}
                variant="gradient"
                loading={loading}
                subtitle="Avg CPU (last record)"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Efficiency Score"
                value={dashboardData.overview.efficiencyScore}
                unit={"%"}
                icon={Speed}
                color={colors.primary[500]}
                variant="gradient"
                loading={loading}
                subtitle="Optimization level"
                progress={dashboardData.overview.efficiencyScore}
                progressLabel="Target: 90%"
              />
            </Grid>
          </Grid>
        </motion.div>

        {/* Anomaly Alerts Section */}
        <motion.div variants={itemVariants}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <AnomalyAlertWidget provider="aws" compact={false} />
            </Grid>
            <Grid item xs={12} md={6}>
              <RightsizingWidget defaultProvider="aws" />
            </Grid>
          </Grid>
        </motion.div>

        {/* Charts Section (placeholder for future charts) */}

        <Routes>
          {/* Removed nested AIRecommendations and CloudMonitoring routes. Use top-level routes in App.jsx */}
        </Routes>
      </motion.div>
    </DashboardLayout>
  );
};

export default Dashboard;
