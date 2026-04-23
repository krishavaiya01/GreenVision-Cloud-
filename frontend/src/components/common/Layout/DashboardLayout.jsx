  import React, { useState, useEffect } from 'react';
import {
  Box,
  CssBaseline,
  Container,
  useTheme,
  useMediaQuery,
  Backdrop,
  Fab,
  Tooltip as MuiTooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useLocation, useNavigate } from 'react-router-dom';

// Constants
const DRAWER_WIDTH = 280;
const HEADER_HEIGHT = 94;

// Styled Components
const Main = styled('main', {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  flexGrow: 1,
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  paddingTop: HEADER_HEIGHT,
  marginLeft: open ? DRAWER_WIDTH : 0,
  transition: theme.transitions.create(['margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.standard,
  }),
  display: 'flex',
  flexDirection: 'column',
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  flex: 1,
  paddingTop: 0,
  paddingBottom: 0, // Removed bottom padding to eliminate extra space
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 'none !important', // Remove container max-width constraints
  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

// Animations
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export default function DashboardLayout({ children, title }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <CssBaseline />

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        drawerWidth={DRAWER_WIDTH}
        isMobile={isMobile} // Added isMobile prop
      />

      {/* Overlay for mobile sidebar */}
      {isMobile && (
        <Backdrop
          open={sidebarOpen}
          onClick={() => setSidebarOpen(false)}
          sx={{
            zIndex: theme.zIndex.drawer - 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // Added proper backdrop color
          }}
        />
      )}

      {/* Header */}
      <Header
        onSidebarToggle={handleSidebarToggle}
        title={title}
        sx={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen && !isMobile ? DRAWER_WIDTH : 0,
          width: `calc(100% - ${sidebarOpen && !isMobile ? DRAWER_WIDTH : 0}px)`,
          zIndex: theme.zIndex.drawer + 1,
          margin: 0, // Ensure no margin
        }}
      />

      {/* Main Content */}
      <Main open={sidebarOpen && !isMobile}>
        <ContentContainer>
          <AnimatePresence mode="wait">
            <motion.div
              key={title || 'page'}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
              style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                minHeight: 0 // Prevents flex items from overflowing
              }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </ContentContainer>
        {/* Floating AI Assistant Button (hidden on /ai-assistant) */}
        {location.pathname !== '/ai-assistant' && (
          <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: theme.zIndex.drawer + 2 }}>
            <MuiTooltip title="Open AI Assistant">
              <Fab color="primary" variant="extended" onClick={() => navigate('/ai-assistant')} sx={{ boxShadow: 6 }}>
                <SmartToyIcon sx={{ mr: 1 }} /> AI Assistant
              </Fab>
            </MuiTooltip>
          </Box>
        )}
      </Main>
    </Box>
  );
}
