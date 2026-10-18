import {createRoute} from '@granite-js/react-native';
import {P0GameScreen} from '../app/screens/P0GameScreen';

// Attribution is fixed by native bootstrap, not by navigation or screen rendering.
export const Route = createRoute('/shared', {component:P0GameScreen});
