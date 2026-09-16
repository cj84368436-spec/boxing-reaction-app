// @ts-expect-error Metro provides require.context at bundle time.
export const context = require.context('./pages');
