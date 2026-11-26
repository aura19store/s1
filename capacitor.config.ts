import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aura.store',
  appName: 'AURA',
  webDir: 'public',
  server: {
    url: 'https://aura.astore.workers.dev',
    cleartext: false
  }
};

export default config;