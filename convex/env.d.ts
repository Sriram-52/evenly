// Convex's runtime provides `process.env`, but this Expo project has no
// @types/node installed. Declare the minimal shape so `tsc` resolves
// `process.env` in Convex functions, without dragging Node's full global types
// into the React Native app.
declare const process: {
  env: Record<string, string | undefined>;
};
