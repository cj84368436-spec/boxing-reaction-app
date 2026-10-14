import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'boxing-talent-test',
  // Keep mappings; embedded artwork already exists in the executable bundle.
  build: {esbuild: {sourcesContent: false}},
  plugins: [
    appsInToss({
      appType: 'game',
      brand: {
        displayName: '복싱재능테스트',
        primaryColor: '#E5484D',
        icon: 'https://static.toss.im/appsintoss/36427/968d0d59-edf0-4d62-aa52-b05820a3d04b.png',
      },
      navigationBar: {
        withBackButton: false,
        withHomeButton: false,
        withTitle: false,
        transparentBackground: true,
        theme: 'dark',
      },
      permissions: [],
    }),
  ],
});
