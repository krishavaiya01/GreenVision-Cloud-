import { createTheme } from '@mui/material/styles';
import { colors } from './colors';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary[400],
      light: colors.primary[200],
      dark: colors.primary[600],
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: colors.secondary.mint.main,
      light: colors.secondary.mint.light,
      dark: colors.secondary.teal.dark
    },
    background: {
      default: '#0A0E0A',
      paper: '#1A1F1A',
      dashboard: 'linear-gradient(135deg, #0A0E0A 0%, #1A2E1A 100%)'
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)'
    },
    success: {
      main: colors.status.excellent.main,
      light: colors.status.excellent.light,
      dark: colors.status.excellent.dark
    },
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
      color: '#FFFFFF',
      letterSpacing: '-0.02em'
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.3,
      color: '#FFFFFF',
      letterSpacing: '-0.01em'
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#FFFFFF'
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#FFFFFF'
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: '#FFFFFF'
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: '#FFFFFF'
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: 'rgba(255, 255, 255, 0.87)'
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: 'rgba(255, 255, 255, 0.7)'
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: 'rgba(255, 255, 255, 0.5)'
    }
  },

  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(76, 175, 80, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 32px rgba(76, 175, 80, 0.12)',
          }
        }
      }
    },
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
          borderColor: colors.primary[400],
          color: colors.primary[400],
          '&:hover': {
            backgroundColor: 'rgba(76, 175, 80, 0.08)',
            borderColor: colors.primary[300],
          }
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
            },
            '&:hover fieldset': {
              borderColor: colors.primary[400],
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary[400],
            }
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: 16,
          backgroundImage: 'none',
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        }
      }
    }
  },

  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
      xxl: 1920
    }
  },

  spacing: 8,

  zIndex: {
    drawer: 1200,
    appBar: 1100,
    tooltip: 1500,
    modal: 1300,
  }
});
