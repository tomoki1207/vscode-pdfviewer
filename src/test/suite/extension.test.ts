import * as assert from 'assert';
import { disposeAll, Disposable } from '../../disposable';

suite('Disposable Tests', () => {
  test('disposeAll should dispose all items and empty array', () => {
    let disposed = 0;
    const disposables = [
      { dispose: () => disposed++ },
      { dispose: () => disposed++ },
      { dispose: () => disposed++ },
    ];
    disposeAll(disposables);
    assert.strictEqual(disposed, 3);
    assert.strictEqual(disposables.length, 0);
  });

  test('disposeAll should empty the array', () => {
    const arr: { dispose: () => void }[] = [{ dispose: () => {} }];
    disposeAll(arr);
    assert.strictEqual(arr.length, 0);
  });

  test('Disposable.dispose sets isDisposed to true', () => {
    class TestDisposable extends Disposable {
      get disposed() { return this.isDisposed; }
    }
    const d = new TestDisposable();
    assert.strictEqual(d.disposed, false);
    d.dispose();
    assert.strictEqual(d.disposed, true);
  });

  test('Disposable.dispose is idempotent', () => {
    class TestDisposable extends Disposable {
      get disposed() { return this.isDisposed; }
    }
    const d = new TestDisposable();
    d.dispose(); d.dispose();
    assert.strictEqual(d.disposed, true);
  });

  test('Multiple Disposable instances are independent', () => {
    class TestDisposable extends Disposable {
      get disposed() { return this.isDisposed; }
    }
    const a = new TestDisposable();
    const b = new TestDisposable();
    a.dispose();
    assert.strictEqual(a.disposed, true);
    assert.strictEqual(b.disposed, false);
  });
});
