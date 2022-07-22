# zodiarg

Cli Argumentns Parser with zod validator.

```
npm install --save zodiarg
```

## Example

```ts
// npx ts-node examples/sample.ts --name mizchi --age 35 --dry --active false xxx 1
import { z } from "zod";
import { define, asNumber, asBoolean, run } from "zodiarg";

const cliSchema = define({
  // --xxx 1
  options: {
    name: z.string().describe(": input your name"),
    age: asNumber.describe(": xxx"),
    active: asBoolean
  },
  // --flag
  flags: {
    dry: z.boolean().default(false),
  },
  // ... a b c
  args: [
    z.string().describe(": input your first name"),
    z.string().regex(/^\d+$/).transform(Number)
  ]
});

const parsed = run(cliSchema, process.argv.slice(2));

main(parsed).catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main(input: typeof parsed) {
  console.log(input);
}
```

Run

```
$ npx ts-node examples/sample.ts --name mizchi --age 35 --dry --active false xxx 1
Parsed Input {
  flags: { dry: true },
  options: { name: 'mizchi', age: 35, active: true },
  args: [ 'xxx', 1 ]
}
```

```
$ npx ts-node examples/sample.ts
```


## LICENSE

MIT