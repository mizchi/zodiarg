import { z, ZodTypeAny } from "zod";

type PositionalTuple = Parameters<typeof z.tuple>[0];

export type ZodCliSchema<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple> = {
  alias?: {[key: string]: keyof (Options & Flags)},
  options?: Options,
  flags?: Flags,
  args?: Positional
};

export const define = <Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(
  schema: ZodCliSchema<Options, Flags, Positional>
): ZodCliSchema<Options, Flags, Positional> => {
  return schema;
}

function resolveAlias(key: string, alias: {[key: string]: any} = {}) {
  return alias[key] ?? key;
}

function toObject<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[]) {
  const flagSet = new Set<string>();
  const optionMap = new Map<string, z.Schema>();

  // Override help flags
  // @ts-ignore
  schema.alias ??= {};
  // @ts-ignore
  schema.alias.h ??= 'help';
    // @ts-ignore
  schema.flags ??= {};
  // @ts-ignore
  schema.flags.help ??= z.boolean().default(false);

  const obj = {
    flags: {} as any,
    options: {} as any,
    args: [] as any,
  };
  
  for (const k of Object.keys(schema.flags ?? {})) {
    flagSet.add(resolveAlias(k, schema.alias));
  };

  for (const [k, v] of Object.entries(schema.options ?? {})) {
    optionMap.set(resolveAlias(k, schema.alias), v);
  };
  
  let leaderKey: null | string = null;
  let positionalIndex: number = 0;
  let cur = 0;
  while(args[cur]) {
    const arg = args[cur];
    if (leaderKey && arg.startsWith("--")) {
      throw new Error("invalid sequence");
    }
    if (leaderKey) {
      obj.options[leaderKey] = arg;
      leaderKey = null;
    } else if (arg.startsWith("-")) {
      const prefix = arg.match(/^-+/)?.[0]!;
      const realkey = resolveAlias(arg.slice(prefix.length), schema.alias);
      if (arg.includes("=")) {
        const [k, v] = realkey.split("=");
        if (optionMap.has(k)) {
          obj.options[k] = v;
        }
      } else {
        const key = realkey
        if (flagSet.has(key)) {
          obj.flags[key] = true;
        } else if (optionMap.has(key)) {
          leaderKey = key;
        }  
      }
    } else {
      const sch = schema.args?.[positionalIndex];
      if (sch == null) {
        throw new Error(`Undefined: ${arg}`)
      }
      obj.args.push(arg);
      positionalIndex++;
    }
    cur++;
  }
  return obj;
}

function toZodShape<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>) {
  return z.object({
    flags: z.object(schema.flags ?? {}),
    options: z.object(schema.options ?? {}),
    args: z.tuple(schema.args ?? [])
  });
}

export function _parse<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[]) {
  const obj = toObject(schema, args);
  return toZodShape(schema).safeParse(obj);
}

export function parse<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[], {help = true, helpWithNoArgs = false}: { help?: boolean, helpWithNoArgs?: boolean } = {}) {
  if (helpWithNoArgs && args.length === 0) {
    console.log(generateHelp(schema as any), '');
    process.exit(0);
  }
  const result = _parse(schema, args);
  if (result.success) {
    // @ts-ignore
    if (help && (result.data.flags.help || result.data.flags.h)) {
      console.log(generateHelp(schema as any), '');
      process.exit(0);
    }
    return result.data;
  } else {
    reportError(result);
    process.exit(1);
  }
}


export const asNumberString = z.string().regex(/^([1-9]+[0-9]*|0)(\.\d+)?$/).transform(Number);

export const asBooleanString = z.string().regex(/^(true|false)$/).transform(Boolean);

function findZodDescription(node: any) {
  let def = node;
  while (def) {
    if (def.description) {
      return def.description;
    }
    // @ts-ignore
    def = def._def ?? def.schema;
  }
  return '';
}

function findZodType(node: any) {
  // let def = node._def;
  while (node) {
    // console.log("type", def);
    if (node?.typeName) {
      // console.log("node", node);
      switch(node.typeName) {
        case 'ZodEnum': {
          return `enum: ${node.values.map((v: string) => `[${v}]`).join(' ')}`;
        }
        case 'ZodString': {
          if (node.checks?.kind === 'regex') {
            return `regex(${node.checks.regex})`;
          }
          return 'string';
        }
        case 'ZodNumber': {
          return 'number';
        }
        case 'ZodBoolean': {
          return 'boolean';
        }
      }
    }
    // @ts-ignore
    node = node?._def ?? node?.schema;
  }
  return '';
}

function isOptionalOrDefault(node: any): [optional: boolean, defaultValue?: any] {
  let def = node._def;
  while (def) {
    if (def.typeName === 'ZodOptional') {
      return [true];
    }
    if (def.typeName === 'ZodDefault') {
      return [true, def.defaultValue()];
    }
    // @ts-ignore
    def = def._def ?? def.schema;
  }
  return [false];
}

type ZodiargAnalyzed = {
  desc: string,
  type: any,
  short?: string,
  optional: [false, undefined] | [true, undefined] | [true, any],
}

function _analyzeZod(k: string, v: ZodTypeAny, alias: any): ZodiargAnalyzed {
  const desc = findZodDescription(v);
  const type = findZodType(v);
  const shortKey = Object.entries(alias ?? {}).find(([, v]) => v === k)?.[0];
  const optional = isOptionalOrDefault(v) as any;
  return {
    desc,
    type,
    short: shortKey,
    optional,
  }
}

export function generateHelp(cliSchema: ZodCliSchema<z.ZodRawShape, z.ZodRawShape, PositionalTuple>, prefix: string = '') {
  let helpText = '';
  helpText += `${prefix}OPTIONS:\n`;
  const t = <T extends any>(t: T, out: (t: NonNullable<T>) => string) => t ? out(t!): '';
  for (const [k, v] of Object.entries(cliSchema.options ?? {})) {
    const {desc, short, optional: [isOptional, defaultValue], type  } = _analyzeZod(k, v, cliSchema.alias);
    const base = `--${k}${t(short, (t) => `, -${t}`)}${t(type, (tt) => ` <${tt}>`)}`;
    const opt = t(isOptional, () => ` (Optional${t(defaultValue, (tt) => `: ${tt})`)}`);
    helpText += `${prefix}  ${base}${opt}${t(desc, (tt) => `\t${tt}`)}\n`;
  }
  helpText += `${prefix}FLAGS:\n`;
  for (const [k, v] of Object.entries(cliSchema.flags ?? {})) {
    const {desc, short  } = _analyzeZod(k, v, cliSchema.alias);
    helpText += `${prefix}  --${k}${t(short, (tt) => `, -${tt}`)}${desc ? `\t${desc}` : ''}\n`;
  }

  helpText += `${prefix}ARGS:\n`;
  for (const n in cliSchema.args ?? []) {
    const v = cliSchema.args?.[n];
    const { desc } = _analyzeZod(n, v!, cliSchema.alias);
    helpText += `${prefix}  ${n}${desc ? `\t${desc}`: ''}\n`;
  }
  return helpText;
}

export function reportError(result: z.SafeParseError<any>) {
  console.error(`[zodiarg:error] ParseError`);
  for (const err of result.error.issues) {
    const firstPath = err.path[0];
    switch (firstPath) {
      case 'positional': {
        console.error(`  args[${err.path[1]}]: ${err.code}`)
        break;
      }
      case 'flags':
      case 'options': {
        console.error(`  --${err.path[1]}: ${err.code}`)
        break;
      }
    }
  }
}

