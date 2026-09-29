// The unchanged desktop tools use NodeNext .js specifiers for TypeScript files.
// Apply only to mcp-server/src/tools/*.ts so Turbopack can share those sources.
module.exports = function localMcpImports(source) {
  return source.replaceAll('from "./shared.js"', 'from "./shared"');
};
