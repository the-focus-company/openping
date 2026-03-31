const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const convexDir = path.resolve(monorepoRoot, "convex");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro sees convex/_generated changes
config.watchFolders = [monorepoRoot];

// Follow pnpm symlinks
config.resolver.unstable_enableSymlinks = true;

// Resolve node_modules from both project and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Remap @convex/* imports to ../../convex/*
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@convex/")) {
    const rest = moduleName.slice("@convex/".length);
    const newModuleName = path.resolve(convexDir, rest);
    return context.resolveRequest(context, newModuleName, platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
