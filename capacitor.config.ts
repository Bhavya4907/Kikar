import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Paneer.Kikar',
  appName: 'Kikar',
  webDir: 'out',
  server: {
    url: 'https://kikar-git-main-bhavya4907s-projects.vercel.app/',
    cleartext: true
  }
};

export default config;