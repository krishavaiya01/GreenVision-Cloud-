import React, { useState } from 'react';
import logo from '../../../assets/logo.png';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Collapse,
  alpha,
  useTheme
} from '@mui/material';
import {
  Dashboard,
  Cloud,
  Psychology,
  CloudSync,
  Analytics,
  Chat,
  Settings,
  Help,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import Gavel from '@mui/icons-material/Gavel';
import VerifiedUser from '@mui/icons-material/VerifiedUser';
import { Link } from "react-router-dom";
import ForestIcon from '@mui/icons-material/Forest';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import { styled } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

// Styled Drawer with Dark Mode support
const StyledDrawer = styled(Drawer)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    '& .MuiDrawer-paper': {
      background: isDark
        ? 'linear-gradient(160deg, rgba(18,18,18,0.85) 0%, rgba(40,40,40,0.75) 100%)'
        : 'linear-gradient(160deg, rgba(249,251,249,0.85) 0%, rgba(166,196,168,0.75) 100%)',
      borderRight: `1px solid ${alpha(isDark ? '#FFFFFF' : '#000000', 0.1)}`,
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      color: isDark ? '#FFFFFF' : '#000000',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    },
  };
});

const SidebarLogo = () => (
  <Box sx={{ p: 2, textAlign: 'center', borderBottom: (theme) => `1px solid ${alpha(theme.palette.mode === 'dark' ? '#FFFFFF' : '#000000', 0.1)}` }}>
    <img src={logo} alt="GreenVision Cloud Logo" style={{ height: 60, width: 'auto' }} />
  </Box>
);

const MenuSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 2),
  marginTop: theme.spacing(0.5),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 700,
  color: alpha(theme.palette.mode === 'dark' ? '#FFFFFF' : '#000000', 0.6),
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: theme.spacing(0.5),
  marginLeft: theme.spacing(1),
}));

const StyledListItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'active'
})(({ theme, active }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: 12,
    margin: theme.spacing(0.25, 0),
    padding: theme.spacing(1, 2),
    transition: 'all 0.25s ease',
    color: active
      ? isDark ? '#81C784' : '#1B5E20'
      : isDark ? '#EEEEEE' : '#020202',
    backgroundColor: active
      ? alpha(isDark ? '#81C784' : '#A5D6A7', 0.35)
      : 'transparent',

    '& .MuiListItemIcon-root': {
      color: active
        ? isDark ? '#81C784' : '#1B5E20'
        : alpha(isDark ? '#EEEEEE' : '#070707', 0.85),
      minWidth: 40,
    },

    '&:hover': {
      backgroundColor: alpha(isDark ? '#81C784' : '#A5D6A7', 0.2),
      transform: 'translateX(4px)',
    },
  };
});

const Sidebar = ({ open, onClose, width, isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({});

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const handleExpandClick = (itemId) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => {
    if (isActive(item.path)) return true;
    return item.subItems?.some(subItem => isActive(subItem.path)) || false;
  };

  const menuSections = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Dashboard, path: '/dashboard' }
      ]
    },
    {
      title: 'Monitoring',
      items: [
        { 
          id: 'cloud-monitoring', 
          label: 'Cloud Monitoring', 
          icon: Cloud, 
          path: '/cloud-monitoring', // changed from /dashboard/cloud-monitoring
          subItems: [
            { label: 'AWS Resources', path: '/cloud-monitoring/aws' },
            { label: 'Azure Resources', path: '/cloud-monitoring/azure' },
            { label: 'GCP Resources', path: '/cloud-monitoring/gcp' }
          ] 
        },
        { id: 'carbon-tracker', label: 'Carbon Footprint', icon: ForestIcon, path: '/dashboard/carbon-tracking' }
      ]
    },
    {
      title: 'Optimization',
      items: [
        { id: 'ai-recommendations', label: 'AI Recommendations', icon: Psychology, path: '/ai-recommendations' }, // changed from /dashboard/ai-recommendations
        { id: 'multi-cloud', label: 'Multi-Cloud Manager', icon: CloudSync, path: '/dashboard/multi-cloud' }
      ]
    },
    {
      title: 'Kubernetes',
      items: [
        {
          id: 'k8s',
          label: 'Kubernetes Manager',
          icon: CloudSync,
          path: '/dashboard/kubernetes',
          subItems: [
            { label: 'AWS (EKS)', path: '/dashboard/kubernetes?provider=aws' },
            { label: 'Azure (AKS)', path: '/dashboard/kubernetes?provider=azure' },
            { label: 'GCP (GKE)', path: '/dashboard/kubernetes?provider=gcp' },
          ]
        }
      ]
    },
    {
      title: 'Analytics',
      items: [
        { id: 'analytics', label: 'Predictive Analytics', icon: Analytics, path: '/dashboard/analytics' },
        { id: 'carbon-offsets', label: 'Carbon Offsets', icon: LocalFloristIcon, path: '/dashboard/carbon-offsets' }
      ]
    },
    {
      title: 'Governance',
      items: [
        { id: 'compliance', label: 'Compliance', icon: Gavel, path: '/compliance' }
      ]
    },
    {
      title: 'Support',
      items: [
        { id: 'chatbot', label: 'AI Assistant', icon: Chat, path: '/ai-assistant' }
      ]
    }
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo at top */}
      <SidebarLogo />
      
      {/* Scrollable Menu */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 0 }}>
        {menuSections.map((section, sectionIndex) => (
          <MenuSection key={section.title}>
            <SectionTitle variant="overline">{section.title}</SectionTitle>
            <List disablePadding>
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                const active = isParentActive(item);
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const expanded = expandedItems[item.id];

                return (
                  <motion.div
                    key={item.id}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: (sectionIndex * 0.1) + (itemIndex * 0.05) }}
                  >
                    <ListItem disablePadding>
                      <StyledListItemButton
                        active={active}
                        onClick={() => hasSubItems ? handleExpandClick(item.id) : handleNavigation(item.path)}
                      >
                        <ListItemIcon><Icon /></ListItemIcon>
                        <ListItemText primary={item.label} />
                        {hasSubItems && (expanded ? <ExpandLess /> : <ExpandMore />)}
                      </StyledListItemButton>
                    </ListItem>

                    {hasSubItems && (
                      <Collapse in={expanded} timeout="auto">
                        <List component="div" disablePadding>
                          {item.subItems.map((subItem) => (
                            <ListItem disablePadding key={subItem.path}>
                              <StyledListItemButton
                                active={isActive(subItem.path)}
                                onClick={() => handleNavigation(subItem.path)}
                                sx={{ pl: 6 }}
                              >
                                <ListItemText primary={subItem.label} />
                              </StyledListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>
                    )}
                  </motion.div>
                );
              })}
              
            </List>
          </MenuSection>
        ))}
      </Box>

      {/* Bottom: Settings, Help */}
      <Box sx={{ 
        p: 1, 
        borderTop: (theme) => `1px solid ${alpha(theme.palette.mode === 'dark' ? '#FFFFFF' : '#000000', 0.1)}`
      }}>
        <List disablePadding>
          <ListItem disablePadding>
            <StyledListItemButton 
              active={isActive('/settings')}
              onClick={() => handleNavigation('/settings')}
            >
              <ListItemIcon><Settings /></ListItemIcon>
              <ListItemText primary="Settings" />
            </StyledListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <StyledListItemButton 
              active={isActive('/help')}
              onClick={() => handleNavigation('/help')}
            >
              <ListItemIcon><Help /></ListItemIcon>
              <ListItemText primary="Help & Support" />
            </StyledListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: width,
          boxSizing: 'border-box'
        }
      }}
    >
      {drawer}
    </StyledDrawer>
  );
};

export default Sidebar;
