import * as vscode from 'vscode';

const SECTION = 'pdf-preview';

// The subset of JSON Schema that package.json uses for our settings
interface SettingSchema {
  readonly type: 'string' | 'boolean' | 'integer';
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
}

const TYPE_CHECKS: Record<SettingSchema['type'], (value: unknown) => boolean> =
  {
    string: (value) => typeof value === 'string',
    boolean: (value) => typeof value === 'boolean',
    integer: (value) => Number.isInteger(value),
  };

function isValid(value: unknown, schema: SettingSchema): boolean {
  if (!TYPE_CHECKS[schema.type]?.(value)) {
    return false;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return false;
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value as string)) {
    return false;
  }
  if (schema.minimum !== undefined && (value as number) < schema.minimum) {
    return false;
  }
  return true;
}

// Reads `pdf-preview.*` settings, checked against the schema in package.json.
// VS Code does not enforce the schema, and in an untrusted workspace the
// values can come from the repository's .vscode/settings.json
export class Settings {
  private readonly _schemas: Record<string, SettingSchema>;
  private readonly _reported = new Set<string>();

  constructor(
    // The extension's package.json
    packageJSON: {
      contributes: { configuration: { properties: Record<string, unknown> } };
    },
    private readonly log?: vscode.LogOutputChannel
  ) {
    this._schemas = packageJSON.contributes.configuration.properties as Record<
      string,
      SettingSchema
    >;
  }

  // Returns the value from the most specific scope that holds a valid one:
  // an invalid workspace value falls back to the user's value, not straight
  // to the default
  public get<T>(key: string): T {
    const name = `${SECTION}.${key}`;
    const schema = this._schemas[name];
    if (!schema) {
      throw new Error(`Unknown setting ${name}`);
    }
    const inspected = vscode.workspace.getConfiguration(SECTION).inspect(key);
    for (const [scope, value] of [
      ['workspace', inspected?.workspaceValue],
      ['user', inspected?.globalValue],
    ] as const) {
      if (value === undefined) {
        continue;
      }
      if (isValid(value, schema)) {
        return value as T;
      }
      this.reportInvalid(name, scope, value);
    }
    return inspected?.defaultValue as T;
  }

  private reportInvalid(name: string, scope: string, value: unknown): void {
    const description = `${name} = ${JSON.stringify(value).slice(0, 200)} (${scope})`;
    if (!this._reported.has(description)) {
      this._reported.add(description);
      this.log?.warn(`Ignoring invalid setting ${description}`);
    }
  }
}
