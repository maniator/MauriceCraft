import type { CoreGameCommandDependencies } from './core-game-commands';

/** Defer optional command implementations until opening the console. */
export function createLazyCommandLoader(deps: CoreGameCommandDependencies): () => Promise<void> {
  let loading: Promise<void> | null = null;
  return () => {
    if (loading) return loading;
    loading = import('./core-game-commands')
      .then(({ registerCoreGameCommands }) => {
        registerCoreGameCommands(deps);
      }).catch(error => {
        // The next command-bar open should retry after a transient failure.
        loading = null;
        throw error;
      });
    return loading;
  };
}
