jest.mock('@apps-in-toss/framework/plugins', () => ({appsInToss: (options: unknown) => options}));
jest.mock('@granite-js/react-native/config', () => ({defineConfig: (options: unknown) => options}));
jest.mock('@granite-js/react-native', () => ({createRoute: (path: string, options: unknown) => ({path, ...options as object})}));
jest.mock('../screens/P0GameScreen', () => ({P0GameScreen: jest.fn(() => null)}));

import config from '../../../granite.config';
import {Route} from '../../pages';
import {P0GameScreen} from '../screens/P0GameScreen';
import {ACTIVE_RECORDS_BANNER_AD_GROUP_ID} from '../ads/adGroupIds';

describe('release configuration', () => {
  it('keeps source maps while avoiding a second copy of embedded artwork', async () => {
    const rawConfig = await config as unknown as {build?: {esbuild?: {sourcesContent?: boolean}}};
    expect(rawConfig.build?.esbuild?.sourcesContent).toBe(false);
  });
  it('matches the name registered in the Toss console exactly', async () => {
    const rawConfig = await config as unknown as {plugins: unknown[]};
    expect(rawConfig.plugins[0]).toMatchObject({brand: {displayName: '복싱재능테스트'}});
  });
  it('opens the game directly without a diagnostic entry screen', () => {
    expect(Route).toMatchObject({path: '/', component: P0GameScreen});
  });
  it('uses the issued live records banner group', () => {
    expect(ACTIVE_RECORDS_BANNER_AD_GROUP_ID).toBe('ait.v2.live.1dae02e06eca49ee');
  });
});
