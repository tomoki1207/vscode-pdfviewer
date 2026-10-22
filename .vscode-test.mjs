import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/src/test/**/*.test.js',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
});
