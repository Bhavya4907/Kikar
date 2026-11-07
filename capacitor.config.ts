import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Paneer.Kikar',
  appName: 'Kikar',
  webDir: 'out',
  backgroundColor: '#0d0d0d',
  server: {
    url: 'https://kikar-git-main-bhavya4907s-projects.vercel.app/',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0d0d0d',
    allowMixedContent: true,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0d0d0d',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
