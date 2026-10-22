import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/src/test/**/*.test.js',
  // Under Wayland the compositor stops sending frames to a hidden or
  // occluded window, so webviews never render and the tests time out.
  // Under X11 (XWayland, or xvfb on CI) Chromium paces frames itself
  launchArgs: ['--ozone-platform=x11'],
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
});
