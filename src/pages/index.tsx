import { createRoute } from '@granite-js/react-native';
import React from 'react';
import { P0GameScreen } from '../app/screens/P0GameScreen';

export const Route = createRoute('/', {
  component: P0GameScreen,
});
