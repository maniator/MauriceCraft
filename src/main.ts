import './styles/global.css';
import { monitorStartup, showStartupFailure } from './startup/startup-health';
import { setupPwa } from './pwa/register';

// Preserve graceful WebGL/error handling and explicitly start only after import.
monitorStartup();
// PWA update-safety listeners must be installed before gameplay can start.
setupPwa();
void import('./game/bootstrap')
  .then(({ startGameApplication }) => startGameApplication())
  .catch(error => showStartupFailure(error));
