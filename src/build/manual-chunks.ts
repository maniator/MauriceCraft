const NODE_MODULES_SEGMENT = '/node_modules/';

function hasModulePath(id: string, moduleName: string): boolean {
  return id.includes('/' + moduleName + '/');
}

// Keep large runtime dependencies in stable chunks so browser updates download less.
export function resolveManualChunk(id: string): string | undefined {
  if (id.startsWith('\0') || !id.includes(NODE_MODULES_SEGMENT)) return undefined;
  if (hasModulePath(id, 'three')) return 'vendor-three';
  if (hasModulePath(id, 'dexie')) return 'vendor-storage';
  return 'vendor';
}
