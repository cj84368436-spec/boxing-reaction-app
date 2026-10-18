import {initializeNativeEntrySource} from './app/product/nativeEntrySource';
import {installNativeProductAnalytics} from './app/analytics/nativeProductAnalytics';
import {playRuntime} from './app/product/playRuntime';
import { AppsInToss } from '@apps-in-toss/framework';
import type { InitialProps } from '@granite-js/react-native';
import type { PropsWithChildren } from 'react';
import { context } from '../require.context';

function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return <>{children}</>;
}

initializeNativeEntrySource(playRuntime);
installNativeProductAnalytics(playRuntime.events);

export default AppsInToss.registerApp(AppContainer, { context });
