import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  MoreVert,
  GetApp,
  Share,
  Info,
  Remove
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { colors } from '../../../styles/theme/colors';

// Styled Components
const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'variant' && prop !== 'color' && prop !== 'onClick'
})(({ theme, variant, color = colors.primary[500], onClick }) => {
  const getBackground = () => {
    switch (variant) {
      case 'gradient':
        return `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`;
      case 'outlined':
        return theme.palette.background.paper;
      default:
        return `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(color, 0.02)} 100%)`;
    }
  };

  const getBorder = () => {
    switch (variant) {
      case 'gradient':
        return `1px solid ${alpha(color, 0.2)}`;
      case 'outlined':
        return `2px solid ${alpha(color, 0.3)}`;
      default:
        return `1px solid ${theme.palette.divider}`;
    }
  };

  return {
    background: getBackground(),
    border: getBorder(),
    position: 'relative',
    overflow: 'visible',
    cursor: onClick ? 'pointer' : 'default', // Only pointer if clickable
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: 16, // Fixed border radius
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
      borderRadius: '16px 16px 0 0',
      opacity: variant === 'outlined' ? 0.8 : 0.6
    },
    
    '&:hover': {
      transform: onClick ? 'translateY(-4px) scale(1.01)' : 'none', // Only animate if clickable
      boxShadow: `0 8px 32px ${alpha(color, 0.12)}`,
    }
  };
});

const IconContainer = styled(Box)(({ theme, color }) => ({
  width: 48, // Reduced from 56
  height: 48, // Reduced from 56
  borderRadius: 12, // Reduced from 16
  background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.25)} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    padding: '1px',
    background: `linear-gradient(135deg, ${alpha(color, 0.3)}, transparent)`,
    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    maskComposite: 'xor',
    WebkitMaskComposite: 'xor', // Safari support
  }
}));

const ValueContainer = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: 6, // Reduced gap
  marginBottom: 12, // Reduced margin
});

const ChangeIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'changeType'
})(({ theme, changeType }) => {
  const getColor = () => {
    switch (changeType) {
      case 'positive': return colors.status.excellent.main;
      case 'negative': return colors.status.poor.main;
      case 'neutral': return colors.neutral[500];
      default: return colors.neutral[400];
    }
  };

  const getBgColor = () => {
    switch (changeType) {
      case 'positive': return alpha(colors.status.excellent.main, 0.1);
      case 'negative': return alpha(colors.status.poor.main, 0.1);
      default: return alpha(colors.neutral[500], 0.1);
    }
  };

  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 10,
    backgroundColor: getBgColor(),
    color: getColor(),
    fontSize: '0.75rem',
    fontWeight: 600,
    minWidth: 'fit-content',
  };
});

// Animation variants
const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  hover: { 
    scale: 1.01,
    transition: { duration: 0.2, ease: "easeInOut" }
  }
};

const MetricCard = ({
  title,
  value,
  unit,
  change,
  changeType = 'neutral',
  changePeriod = 'vs last month',
  icon: Icon,
  color = colors.primary[500],
  variant = 'default',
  progress,
  progressLabel,
  badge,
  badgeColor,
  subtitle,
  onClick,
  loading = false,
  actions = true,
  trend = null
}) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCardClick = () => {
    if (onClick) onClick();
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive': return <TrendingUp sx={{ fontSize: 14 }} />;
      case 'negative': return <TrendingDown sx={{ fontSize: 14 }} />;
      default: return <Remove sx={{ fontSize: 14 }} />;
    }
  };

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return val;
  };

  if (loading) {
    return (
      <Card sx={{ 
        height: '100%', 
        p: 2.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1.5, mb: 2 }} />
        <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 1, width: '80%' }} />
        <Skeleton variant="text" sx={{ fontSize: '0.875rem', width: '60%', mb: 2 }} />
        <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3 }} />
      </Card>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={onClick ? "hover" : {}}
      style={{ height: '100%' }}
    >
      <StyledCard 
        variant={variant}
        color={color}
        onClick={onClick}
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <CardContent sx={{ 
          p: 2.5, 
          flex: 1,
          display: 'flex', 
          flexDirection: 'column',
          '&:last-child': { pb: 2.5 } // Fix MUI CardContent padding issue
        }}>
          {/* Header */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            mb: 2.5,
            minHeight: 48
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
              {Icon && (
                <IconContainer color={color}>
                  <Icon sx={{ color, fontSize: 24 }} />
                </IconContainer>
              )}
              
              <Box sx={{ flex: 1, minWidth: 0 }}> {/* minWidth: 0 prevents text overflow */}
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    lineHeight: 1.3,
                    mb: subtitle || badge ? 0.5 : 0
                  }}
                >
                  {title}
                </Typography>
                
                {subtitle && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      display: 'block',
                      fontSize: '0.75rem',
                      lineHeight: 1.2
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
                
                {badge && (
                  <Chip
                    label={badge}
                    size="small"
                    sx={{
                      bgcolor: alpha(badgeColor || color, 0.15),
                      color: badgeColor || color,
                      fontSize: '0.65rem',
                      height: 18,
                      mt: 0.5,
                      fontWeight: 600,
                      '& .MuiChip-label': { px: 0.75, py: 0 }
                    }}
                  />
                )}
              </Box>
            </Box>

            {actions && (
              <IconButton 
                size="small" 
                onClick={handleMenuClick}
                sx={{ 
                  color: 'text.secondary',
                  ml: 1,
                  '&:hover': { 
                    bgcolor: alpha(color, 0.1) 
                  }
                }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Value */}
          <ValueContainer>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 800, 
                color: color,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                lineHeight: 1,
                background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              {formatValue(value)}
            </Typography>
            
            {unit && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  fontWeight: 500,
                  alignSelf: 'flex-end',
                  mb: 0.5,
                  fontSize: '0.875rem'
                }}
              >
                {unit}
              </Typography>
            )}
          </ValueContainer>

          {/* Progress */}
          {progress !== undefined && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {progressLabel || 'Progress'}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color, fontSize: '0.7rem' }}>
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(color, 0.1),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 3,
                  }
                }}
              />
            </Box>
          )}

          {/* Change Indicator */}
          {change && (
            <Box sx={{ 
              mt: 'auto', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              gap: 1
            }}>
              <ChangeIndicator changeType={changeType}>
                {getChangeIcon()}
                <span>{change}</span>
              </ChangeIndicator>
              
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ 
                  fontSize: '0.7rem',
                  textAlign: 'right',
                  whiteSpace: 'nowrap'
                }}
              >
                {changePeriod}
              </Typography>
            </Box>
          )}

          {/* Trend Line Placeholder */}
          {trend && (
            <Box sx={{ 
              mt: 1.5, 
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(color, 0.05),
              borderRadius: 1,
              border: `1px solid ${alpha(color, 0.1)}`
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                Trend Chart
              </Typography>
            </Box>
          )}
        </CardContent>

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              minWidth: 160,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleMenuClose} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Info fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={handleMenuClose} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <GetApp fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export Data</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={handleMenuClose} sx={{ fontSize: '0.875rem' }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Share fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        </Menu>
      </StyledCard>
    </motion.div>
  );
};

export default MetricCard;
