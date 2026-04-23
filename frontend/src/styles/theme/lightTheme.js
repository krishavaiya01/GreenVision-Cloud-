import { createTheme } from '@mui/material/styles';
import { colors } from './colors';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary[500],
      light: colors.primary[300],
      dark: colors.primary[700],
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: colors.secondary.teal.main,
      light: colors.secondary.mint.light,
      dark: colors.secondary.forest.dark
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
      dashboard: colors.gradients.dashboard
    },
    text: {
      primary: colors.neutral[800],
      secondary: colors.neutral[600]
    },
    success: colors.status.excellent,
    warning: colors.status.moderate,
    error: colors.status.poor,
    info: colors.providers.azure,
  },

  typography: {
    fontFamily: "'Inter', 'SF Pro Display', 'Segoe UI', 'Roboto', sans-serif",
    h1: {
      fontSize: '3rem',
      fontWeight: 800,
      lineHeight: 1.2,
      color: colors.primary[700],
      letterSpacing: '-0.02em'
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.3,
      color: colors.primary[600],
      letterSpacing: '-0.01em'
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: colors.primary[600]
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: colors.primary[500]
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: colors.primary[500]
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: colors.primary[500]
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: colors.neutral[700]
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: colors.neutral[600]
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: colors.neutral[500]
    }
  },

  components: {
    // Card Component Styling
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: colors.gradients.card,
          border: `1px solid ${colors.neutral[200]}`,
          boxShadow: colors.shadows.card,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: colors.shadows.cardHover,
          }
        }
      }
    },

    // Button Component Styling
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '10px 24px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
            transform: 'scale(1.02)',
          }
        },
        contained: {
          background: colors.gradients.primary,
          color: '#FFFFFF',
          '&:hover': {
            background: colors.gradients.environmental,
          }
        },
        outlined: {
          borderColor: colors.primary[300],
          color: colors.primary[600],
          '&:hover': {
            backgroundColor: colors.primary[50],
            borderColor: colors.primary[500],
          }
        }
      }
    },

    // Input Field Styling
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderColor: colors.neutral[300],
            },
            '&:hover fieldset': {
              borderColor: colors.primary[400],
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary[500],
            }
          }
        }
      }
    },

    // Paper (Modal, Drawer) Styling
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        }
      }
    },

    // Chip Styling
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        }
      }
    }
  },

  // Custom breakpoints for desktop-first approach
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,    // Primary desktop target
      xl: 1536,    // Large desktop
      xxl: 1920    // Ultra-wide desktop
    }
  },

  // Custom spacing scale
  spacing: 8,

  // Custom z-index scale
  zIndex: {
    drawer: 1200,
    appBar: 1100,
    tooltip: 1500,
    modal: 1300,
  }
});
