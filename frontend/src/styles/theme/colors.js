// GreenVision Color System - Soft Aesthetic Version
export const colors = {
  // Primary Green Palette (Softened)
  primary: {
  50:  '#fafbfaff',  // very light mint tint (only for hover highlights)
  100: '#C8E6C9',
  200: '#A5D6A7',
  300: '#81C784',
  400: '#4CAF50',  // soft natural green
  500: '#388E3C',  // main brand green (dark but vibrant)
  600: '#2E7D32',  // deep forest green
  700: '#1B5E20',  // darker forest
  800: '#10471B',  // near-emerald dark
  900: '#235833ff',  // deepest dark green (almost black with green tint)
},


  // Secondary Nature Colors
  secondary: {
    mint: {
      light: '#D4FFE0',
      main: '#6DEB9A',
      dark: '#4CCB78'
    },
    forest: {
      light: '#9ED9A6',
      main: '#53B96B',
      dark: '#2D8E4D'
    },
    sage: {
      light: '#E6F2D9',
      main: '#B5D995',
      dark: '#88B26A'
    },
    teal: {
      light: '#7FD2C8',
      main: '#33AFA3',
      dark: '#1F7B70'
    }
  },

  // Environmental Status Colors (Soft tones)
  status: {
    excellent: {
      main: '#4e7356ff',
      light: '#456749ff',
      dark: '#345b3dff',
      bg: '#E9F9F1'
    },
    good: {
      main: '#305838ff',
      light: '#125719ff',
      dark: '#02290bff',
      bg: '#F2FAF1'
    },
    moderate: {
      main: '#FFB74D',
      light: '#FFE0B2',
      dark: '#F57C00',
      bg: '#FFF7EB'
    },
    poor: {
      main: '#FF8A65',
      light: '#FFD9CC',
      dark: '#D84315',
      bg: '#FFF1ED'
    },
    critical: {
      main: '#F56565',
      light: '#FFDADA',
      dark: '#C62828',
      bg: '#FFEDED'
    }
  },

  // Cloud Provider Brand Colors (Softer)
  providers: {
    aws: {
      main: '#FFB84D',
      light: '#FFE0B2',
      dark: '#E68A00',
      bg: '#FFF8E6'
    },
    azure: {
      main: '#42A5F5',
      light: '#BBDEFB',
      dark: '#1565C0',
      bg: '#E3F2FD'
    },
    gcp: {
      main: '#6EA8FF',
      light: '#D6E4FF',
      dark: '#1976D2',
      bg: '#E8EAF6'
    },
    multicloud: {
      main: '#B078D1',
      light: '#E4C5F1',
      dark: '#7B1FA2',
      bg: '#F5E6F8'
    }
  },

  // Neutral Grays
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },

  // Gradients
  gradients: {
  primary: 'linear-gradient(135deg, #094029ff 0%, #2D6A4F 100%)',
  environmental: 'linear-gradient(135deg, #094029ff 0%, #2D6A4F 100%)',
  carbon: 'linear-gradient(135deg, #3f6442ff 0%, #1c3921ff 50%, #0a3112ff 100%)',
  energy: 'linear-gradient(135deg, #3f6442ff 0%, #1c3921ff 50%, #0a3112ff 100%)',
  dashboard: 'linear-gradient(135deg, #094029ff 0%, #2D6A4F 100%)', // same as header
  card: 'linear-gradient(135deg, #FFFFFF 0%, #2D6A4F 100%)', // dark green highlight
  sidebar: 'linear-gradient(180deg, #FFFFFF 0%, #2D6A4F 100%)', // dark green highlight
  header: 'linear-gradient(135deg, #094029ff 0%, #2D6A4F 100%)'
},

  // Shadows (softer)
  shadows: {
    card: '0 2px 8px rgba(76, 175, 80, 0.06)',
    cardHover: '0 8px 32px rgba(76, 175, 80, 0.12)',
    sidebar: '4px 0 24px rgba(0, 0, 0, 0.03)',
    header: '0 2px 16px rgba(76, 175, 80, 0.08)',
    modal: '0 16px 64px rgba(0, 0, 0, 0.1)'
  }
};
