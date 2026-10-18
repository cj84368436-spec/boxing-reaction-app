import {readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

// Load the real router without importing device-only native bridges in Jest.
jest.mock('@granite-js/react-native', () => {
  const {dirname, join} = require('node:path');
  const sdkDirectory = dirname(require.resolve('@granite-js/react-native/package.json'));
  return jest.requireActual(join(sdkDirectory, 'src/router/createRoute'));
});
jest.mock('../screens/P0GameScreen', () => ({P0GameScreen: () => null}));

const sdkDirectory = dirname(require.resolve('@granite-js/react-native/package.json'));
const {getRouteScreens, getScreenPathMapConfig} = jest.requireActual(
  join(sdkDirectory, 'src/router/utils/screen'),
);

describe('app route startup', () => {
  it('initializes the root and unmatched-link routes from the shipped pages', () => {
    const pagesDirectory = resolve(__dirname, '../../../pages');
    const keys = readdirSync(pagesDirectory)
      .filter(file => /\.(ts|tsx)$/.test(file))
      .map(file => `./${file}`);
    const context = Object.assign(
      (key: string) => require(resolve(pagesDirectory, key)),
      {keys: () => keys, resolve: (key: string) => resolve(pagesDirectory, key), id: pagesDirectory},
    );

    const config = getScreenPathMapConfig(getRouteScreens(context));

    expect(config['/']).toEqual({path: ''});
    expect(config['/shared']).toEqual({path: '/shared'});
    const {P0GameScreen}=require('../screens/P0GameScreen');
    expect(require('../../../pages/_404').default).toBe(P0GameScreen);
    expect(jest.requireActual(join(sdkDirectory,'src/router/createRoute')).routeMap.get('/shared').component).toBe(P0GameScreen);
    expect(config['/_404']).toEqual({path: '*'});
  });
});
