// Instrument-faceplate theme for every Clerk surface (sign-in, sign-up, the
// UserButton + its popover). Maps Clerk's appearance variables onto the
// Continuity palette so nothing ships with default Clerk styling.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#e2540a', // flux
    colorText: '#1c1a16', // ink
    colorTextSecondary: '#565047', // ink-2s
    colorBackground: '#f1ecdf', // paper-2
    colorInputBackground: '#fff7e9',
    colorInputText: '#1c1a16',
    colorDanger: '#ff5247', // probe
    colorSuccess: '#1d6e4d',
    borderRadius: '7px',
    fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
  },
  elements: {
    card: {
      backgroundColor: '#f1ecdf',
      border: '1.5px solid #a89d84',
      boxShadow: '0 1px 0 #fff8ec inset, 0 40px 90px -40px #00000070',
      borderRadius: '14px',
    },
    headerTitle: {
      fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      letterSpacing: '-0.01em',
      color: '#1c1a16',
    },
    headerSubtitle: { color: '#8c867a' },
    socialButtonsBlockButton: {
      border: '1px solid #bcb29c',
      backgroundColor: '#fff7e9',
    },
    formButtonPrimary: {
      backgroundColor: '#e2540a',
      color: '#fff7e9',
      textTransform: 'none',
      fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      fontWeight: 600,
      '&:hover': { backgroundColor: '#f06a1f' },
    },
    formFieldInput: {
      backgroundColor: '#fff7e9',
      border: '1px solid #bcb29c',
      color: '#1c1a16',
    },
    formFieldLabel: { color: '#565047' },
    footerActionLink: { color: '#e2540a' },
    footer: { backgroundColor: '#efe9db' },
    userButtonPopoverCard: {
      backgroundColor: '#f1ecdf',
      border: '1.5px solid #a89d84',
    },
    userButtonPopoverActionButton: { color: '#1c1a16' },
    avatarBox: {
      borderRadius: '7px',
      border: '1px solid #a89d84',
    },
    badge: { color: '#e2540a' },
  },
} as const
