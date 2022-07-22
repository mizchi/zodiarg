import { z } from "zod";

type PositionalTuple = Parameters<typeof z.tuple>[0];

export type ZodCliSchema<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple> = {
  options: Options,
  flags: Flags,
  args: Positional
};

export const define = <Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(
  schema: ZodCliSchema<Options, Flags, Positional>
): ZodCliSchema<Options, Flags, Positional> => {
  return schema;
}

function toObject<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[]) {
  const flagSet = new Set<string>();
  const optionMap = new Map<string, z.Schema>();

  for (const [k, v] of Object.entries(schema.flags)) {
    flagSet.add(k);
  };

  for (const [k, v] of Object.entries(schema.options)) {
    optionMap.set(k, v);
  };
  
  let leaderKey: null | string = null;
  let positionalIndex: number = 0;
  const obj = {
    flags: {} as any,
    options: {} as any,
    args: [] as any
  };
  
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
      const keyNoPrefix = arg.slice(prefix.length);

      if (arg.includes("=")) {
        const [key, value] = keyNoPrefix.split("=");
        if (optionMap.has(key)) {
          obj.options[key] = value;
        }
      } else {
        const key = keyNoPrefix
        if (flagSet.has(key)) {
          obj.flags[key] = true;
        } else if (optionMap.has(key)) {
          leaderKey = key;
        }  
      }
    } else {
      const sch = schema.args[positionalIndex];
      if (sch == null) {
        throw new Error("Undefined")
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
    flags: z.object(schema.flags),
    options: z.object(schema.options),
    args: z.tuple(schema.args)
  });
}

export function parse<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[]) {
  const obj = toObject(schema, args);
  return toZodShape(schema).safeParse(obj);
}

export function run<Options extends z.ZodRawShape, Flags extends z.ZodRawShape, Positional extends PositionalTuple>(schema: ZodCliSchema<Options, Flags, Positional>, args: string[]) {
  if (args.length === 0) {
    console.log(generateHelp(schema), '');
    process.exit(0);
  }
  const result = parse(schema, args);
  if (result.success) {
    return result.data;
  } else {
    reportError(result);
    process.exit(1);
  }
}


export const asNumber = z.string().regex(/^([1-9]+[0-9]*|0)(\.\d+)?$/).transform(Number);
export const asBoolean = z.string().regex(/^(true|false)$/).transform(Boolean);

function findDescInZodSchema(node: any) {
  let def = node._def;
  while (def) {
    if (def.description) {
      return def.description;
    }
    // @ts-ignore
    def = def._def ?? def.schema;
  }
  return '';
}

export function generateHelp(cliSchema: ZodCliSchema<z.ZodRawShape, z.ZodRawShape, PositionalTuple>, prefix: string = '') {
  let helpText = '';
  helpText += `${prefix}OPTIONS:\n`;
  for (const [k, v] of Object.entries(cliSchema.options)) {
    const desc = findDescInZodSchema(v);
    const type = v._type;
    helpText += `${prefix}  --${k}${type ? `(${type})` : ''}${desc ?? ''}\n`;
  }
  helpText += `${prefix}FLAGS:\n`;
  for (const [k, v] of Object.entries(cliSchema.flags)) {
    helpText += `${prefix}  --${k} \n`;
  }

  helpText += `${prefix}ARGS:\n`;
  for (const n in cliSchema.args) {
    const v = cliSchema.args[n];
    const desc = findDescInZodSchema(v);
    helpText += `${prefix}  ${n}${desc ?? ''}\n`;
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

