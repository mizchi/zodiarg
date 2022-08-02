# zodiarg

Cli Arguments Parser with [Zod](https://github.com/colinhacks/zod) validator.

```
$ npm install --save zodiarg zod
```

## Example

```ts
// npx ts-node examples/sample.ts --name mizchi --age 34 --dry xxx 1
import { z } from "zod";
import { asNumberString, asBooleanString, parse } from "zodiarg";

const parsed = parse(
  {
    // --key value | --key=value
    options: {
      name: z.string().describe("input your name"),
      env: z.enum(['a', 'b']).describe("env"),
      age: asNumberString.default('1').describe("xxx"), // parse as number
      active: asBooleanString.default('false') // parse as boolean
    },
    // --flagA, --flagB
    flags: {
      dry: z.boolean().default(false),
      shortable: z.boolean().default(false).describe("shortable example"),
    },
    // ... positional args: miz 10
    args: [
      z.string().describe("input your first name"),
      z.string().regex(/^\d+$/).transform(Number)
    ],
    // alias map: s => shortable
    alias: {
      s: 'shortable',
    }
  },
  process.argv.slice(2),
  // Options(default)
  // { help: true, helpWithNoArgs: true }
);

type ParsedInput = typeof parsed; // Inferenced by Zod

main(parsed).catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main(input: ParsedInput) {
  console.log('Parsed Input', input);
}
```

Run

```bash
$ npx ts-node examples/sample.ts --name mizchi --age 34 --dry xxx 1 -s --env a

Parsed Input {
  flags: { dry: true, shortable: true },
  options: { name: 'mizchi', env: 'a', age: 34 },
  args: [ 'xxx', 1 ]
}
```

Show help

```
$ npx ts-node examples/sample.ts -h
OPTIONS:
  --name <string>       input your name
  --env <enum: [a] [b]> env
  --age (Optional: 1)   xxx
FLAGS:
  --dry
  --shortable, -s       shortable example
ARGS:
  0     input your first name
  1
```

## LICENSE

MIT