import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'boxing-talent-test',
  plugins: [
    appsInToss({
      appType: 'game',
      brand: {
        displayName: '복싱 10타 챌린지',
        primaryColor: '#E5484D',
        icon: '',
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
