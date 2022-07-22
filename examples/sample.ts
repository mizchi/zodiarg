// npx ts-node examples/sample.ts --name mizchi --age 35 --dry --active false xxx 1
import { z } from "zod";

import { define, asNumber, asBoolean, run } from "..";

const cliSchema = define({
  options: {
    name: z.string().describe(": input your name"),
    age: asNumber.describe(": xxx"),
    active: asBoolean
  },
  flags: {
    dry: z.boolean().default(false),
  },
  args: [
    z.string().describe(": input your first name"),
    z.string().regex(/^\d+$/).transform(Number)
  ]
});

const parsed = run(cliSchema, process.argv.slice(2));

type ParsedInput = typeof parsed;

main(parsed).catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main(input: ParsedInput) {
  console.log('Parsed Input', input);
}
