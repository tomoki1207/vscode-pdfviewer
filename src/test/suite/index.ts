import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true  // Añadido para reemplazar useColors
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise(async (c, e) => {  // Añadido async aquí
    try {
      // Usar await con glob - esta es la forma correcta
      const files = await glob('**/**.test.js', { cwd: testsRoot });

      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    } catch (err) {
      e(err);
    }
  });
}