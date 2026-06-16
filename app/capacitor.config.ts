import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.gardenmapper.app',
  appName: 'Garden Mapper',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      clientId: '284573774009-9qvnioqqk2mkat7427g3dkh9q2k5gmtk.apps.googleusercontent.com',
    },
  },
};

export default config;
