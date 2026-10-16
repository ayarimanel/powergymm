import { registerRootComponent } from 'expo';
import React, { useEffect, useState } from 'react';
import { loadColorMode } from './src/config/colorMode';

// The light/dark choice must be set before any screen builds its styles,
// so App is required only once the saved mode is loaded.
function Root() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    loadColorMode().then(() => setApp(() => require('./App').default));
  }, []);
  return App ? React.createElement(App) : null;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
