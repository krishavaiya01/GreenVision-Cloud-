import React, { useState } from 'react';
import logo from '../../../assets/logo.png';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Settings,
  AccountCircle,
  DarkMode,
  LightMode,
  CloudQueue,
  Analytics,
  Logout,
  Dashboard as DashboardIcon,
  TrendingUp
} from '@mui/icons-material';
import { useNavigate } from "react-router-dom";
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useTheme as useCustomTheme } from '../../../hooks/useTheme';
import { colors } from '../../../styles/theme/colors';

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "drawerWidth"
})(({ theme, open, drawerWidth }) => ({
  background: colors.gradients.header,
  backdropFilter: 'blur(20px)',
  boxShadow: colors.shadows.header,
  borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
  zIndex: theme.zIndex.drawer + 1,
  position: 'fixed', // ✅ header hamesha fixed
  top: 0,
  left: 0,
  width: '100%',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.standard,
  }),

  ...(open && {
    marginLeft: drawerWidth, // ✅ shift only when sidebar open
    width: `calc(100% - ${drawerWidth}px)`,
    [theme.breakpoints.down('md')]: {
      marginLeft: 0,
      width: '100%', // ✅ mobile pe full width
    },
  }),
}));


const BrandContainer = styled(motion.div)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  userSelect: 'none'
});

const StatusIndicator = styled(Box)(({ theme, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'excellent': return colors.status.excellent.main;
      case 'good': return colors.status.good.main;
      case 'moderate': return colors.status.moderate.main;
      case 'poor': return colors.status.poor.main;
      default: return colors.neutral[400];
    }
  };

  return {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: getStatusColor(),
    boxShadow: `0 0 6px ${getStatusColor()}80`,
    marginTop: 2,
    animation: 'pulse 2s infinite',
    '@keyframes pulse': {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.5 },
      '100%': { opacity: 1 },
    }
  };
});

const Header = ({ sidebarOpen, onSidebarToggle, drawerWidth, title }) => {
  const { user, logoutUser } = useAuth();
  const { isDarkMode, toggleTheme } = useCustomTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const navigate = useNavigate();
  // Mock real-time data - replace with actual data
  const [systemStatus] = useState('good');
  const [notifications] = useState([
    { id: 1, type: 'warning', message: 'AWS usage spike detected', time: '2 min ago' },
    { id: 2, type: 'success', message: 'Carbon footprint reduced by 15%', time: '1 hour ago' },
    { id: 3, type: 'info', message: 'New AI recommendation available', time: '3 hours ago' }
  ]);

  const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
  const handleNotificationClick = (event) => setNotificationAnchor(event.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };
  const handleLogout = () => {
    handleClose();
    logoutUser();
  };
  const handleSettings = () => {
    handleClose();
    navigate("/settings");
  };
  const handleDashboard = () => {
  handleClose();
  navigate("/dashboard"); // or "/dashboard" if that’s your route
};

  return (
    <StyledAppBar 
      position="fixed" 
      open={sidebarOpen} 
      drawerWidth={drawerWidth}
      elevation={0}
    >
      <Toolbar sx={{ minHeight: 64, px: 3 }}>
        {/* Menu Button */}
        <IconButton
          color="inherit"
          aria-label="toggle drawer"
          onClick={onSidebarToggle}
          edge="start"
          sx={{ 
            mr: 2,
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Brand Logo & Title */}
        <BrandContainer
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={() => navigate('/dashboard')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src={logo}
              alt="GreenVision Cloud Logo"
              style={{
                height: 64,
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1) drop-shadow(0 0 6px rgba(255,255,255,0.6))'
              }}
              onError={(e) => { e.target.src = '/fallback-logo.png'; }}
            />
            {/* Title + Status dot beside it */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="h6" 
                noWrap 
                sx={{ 
                  fontWeight: 800, 
                  fontSize: '1.25rem',
                  background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255, 255, 255, 0.8) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                GreenVision Cloud
              </Typography>
              <StatusIndicator status={systemStatus} />
            </Box>
            {title && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block' }}>
                {title}
              </Typography>
            )}
          </Box>
        </BrandContainer>

        {/* Real-time Status Chips */}
        <Box sx={{ ml: 3, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
            <Chip
              icon={<CloudQueue />}
              label="3 Providers"
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                '& .MuiChip-icon': { color: 'rgba(255, 255, 255, 0.8)' }
              }}
            />
          </motion.div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }}>
            <Chip
              icon={<TrendingUp />}
              label="↓ 12% Carbon"
              size="small"
              sx={{
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                color: 'white',
                '& .MuiChip-icon': { color: colors.status.excellent.main }
              }}
            />
          </motion.div>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Theme Toggle */}
          <Tooltip title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
            <IconButton color="inherit" onClick={toggleTheme}>
              <motion.div
                key={isDarkMode ? 'dark' : 'light'}
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {isDarkMode ? <LightMode /> : <DarkMode />}
              </motion.div>
            </IconButton>
          </Tooltip>

          {/* Quick Analytics */}
          <Tooltip title="Quick Stats">
            <IconButton color="inherit" onClick={() => navigate('/dashboard/analytics')}>
              <Analytics />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton color="inherit" onClick={handleNotificationClick}>
              <Badge 
                badgeContent={notifications.length} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: colors.status.poor.main,
                    color: 'white',
                    animation: 'pulse 2s infinite'
                  }
                }}
              >
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
  <IconButton color="inherit" onClick={handleSettings}>
    <Settings />
  </IconButton>
</Tooltip>


          {/* Profile */}
          <Tooltip title="Profile">
            <IconButton color="inherit" onClick={handleProfileClick}>
              <Avatar 
                sx={{ 
                  width: 36, 
                  height: 36,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  fontSize: '1rem',
                  fontWeight: 600
                }}
              >
                {user?.name?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* Menus (Profile + Notifications) */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {user?.name || 'User Name'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email || 'user@example.com'}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleDashboard}>
  <ListItemIcon><DashboardIcon /></ListItemIcon>
  <ListItemText>Dashboard</ListItemText>
</MenuItem>

          <MenuItem onClick={handleSettings}>
  <ListItemIcon><Settings /></ListItemIcon>
  <ListItemText>Settings</ListItemText>
</MenuItem>

          <Divider />
          <MenuItem onClick={handleLogout}><ListItemIcon><Logout sx={{ color: colors.status.poor.main }} /></ListItemIcon><ListItemText>Logout</ListItemText></MenuItem>
        </Menu>

        <Menu anchorEl={notificationAnchor} open={Boolean(notificationAnchor)} onClose={handleClose}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Notifications
            </Typography>
          </Box>
          <Divider />
          {notifications.map((notification) => (
            <MenuItem key={notification.id} onClick={handleClose}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {notification.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {notification.time}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </StyledAppBar>
  );
};

export default Header;
