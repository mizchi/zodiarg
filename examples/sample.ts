// npx ts-node examples/sample.ts --name mizchi --age 34 --dry --active false xxx 1
import { z } from "zod";
import { asNumberString, parse } from "..";

const parsed = parse(
  // zod schema subset
  {
    options: {
      name: z.string().describe("input your name"),
      env: z.enum(['a', 'b']).describe("env"),
      age: asNumberString.default('1').describe("xxx"),
    },
    flags: {
      dry: z.boolean().default(false),
      shortable: z.boolean().default(false).describe("shortable example"),
    },
    args: [
      z.string().describe("input your first name"),
      z.string().regex(/^\d+$/).transform(Number)
    ],
    alias: {
      s: 'shortable',
    }
  },
  // args: string[]
  process.argv.slice(2),
  // Optional options
  // {
  //   help: true, // default: true
  //   helpWithNoArgs: true, // default: false
  // }
);

type ParsedInput = typeof parsed;

main(parsed).catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main(input: ParsedInput) {
  console.log('Parsed Input', input);
  // input.options
  // input.options.name = 1;
}
