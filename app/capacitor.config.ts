import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.gardenmapper.app',
  appName: 'Garden Mapper',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 1200,
      backgroundColor: '#1a3a0a',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
    GoogleAuth: {
      clientId: '284573774009-9qvnioqqk2mkat7427g3dkh9q2k5gmtk.apps.googleusercontent.com',
    },
  },
};

export default config;
