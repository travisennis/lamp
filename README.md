# lamp

## Usage

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod";
import { lamp, eval as lampEval } from "@travisennis/lamp";

// lamp function returns string
const getFruit = lamp(
  { model: anthropic("haiku-latest"), maxTokens: 256, temperature: 1.0 },
  (n: number, color: string) => {
    return `Generate ${String(n)} kinds of ${color} fruit as a comma-separated list.`;
  },
);

const b = await getFruit(4, "red");
console.log(b);

// lamp function returns object
const getListOfFruit = lamp(
  {
    model: anthropic(sonnet-latest"),
    schema: z.object({ fruits: z.array(z.string()) }),
    maxTokens: 256,
    temperature: 1.0,
  },
  (n: number) => {
    return `Generate ${String(n)} kinds of fruit.`;
  },
);

const a = await getListOfFruit(5);
console.dir(a);

// Running on evaluation on a lamp function
const e = lampEval<typeof getFruit>({
  iterations: 2,
  testCases: [
    { input: [3, "red"], output: "" },
    { input: [5, "yellow"], output: "" },
    { input: [10, "green"], output: "" },
  ], // Test with 3, 5, and 10 fruits
  benchmark: true,
  evaluator: (testCase, response) => {
    // Implement your evaluation logic here
    // For example, count the number of fruits mentioned
    const fruitCount = response.text.split(",").length;
    return testCase.input[0] === fruitCount ? 1 : -1;
  },
});

async function runEvaluation() {
  const result = await e.run(getFruit);
  console.log("Evaluation Result:", result);
}

await runEvaluation();

// More complicated example
const countAnimalLegs = lamp(
  {
    model: anthropic("haiku-latest"),
    maxTokens: 500,
  },
  (statement: string) => {
    return `You will be provided a statement about an animal and your job is to determine how many legs that animal has. Follow these steps:
1. Identify the base animal and its normal number of legs
2. Calculate any changes to the number of legs mentioned in the statement (additions, losses, or regrowth)
3. Provide the final total number of legs
Here is the animal statement.
<animal_statement>${statement}</animal_statement>
How many legs does the animal have? Please respond with a number after showing your calculation. Place your answer between <answer> tags.`;
  },
);

const eval_data = [
  { animal_statement: "The animal is a human.", golden_answer: "2" },
  { animal_statement: "The animal is a snake.", golden_answer: "0" },
  {
    animal_statement:
      "The fox lost a leg, but then magically grew back the leg he lost and a mysterious extra leg on top of that.",
    golden_answer: "5",
  },
  { animal_statement: "The animal is a dog.", golden_answer: "4" },
  {
    animal_statement: "The animal is a cat with two extra legs.",
    golden_answer: "6",
  },
  { animal_statement: "The animal is an elephant.", golden_answer: "4" },
  { animal_statement: "The animal is a bird.", golden_answer: "2" },
  { animal_statement: "The animal is a fish.", golden_answer: "0" },
  {
    animal_statement: "The animal is a spider with two extra legs",
    golden_answer: "10",
  },
  { animal_statement: "The animal is an octopus.", golden_answer: "8" },
  {
    animal_statement:
      "The animal is an octopus that lost two legs and then regrew three legs.",
    golden_answer: "9",
  },
  {
    animal_statement:
      "The animal is a two-headed, eight-legged mythical creature.",
    golden_answer: "8",
  },
];

const testCases: { input: [string]; output: string }[] = eval_data.map((d) => {
  return { input: [d.animal_statement], output: d.golden_answer };
});

const countAnimalLegsEval = lampEval<typeof countAnimalLegs>({
  iterations: 1,
  testCases,
  benchmark: true,
  evaluator: (testCase, response) => {
    const match = response.text.match(/<answer>(\d*?)<\/answer>/);
    const actualCount = match ? match[1].trim() : "-1";
    return testCase.output === actualCount ? 1 : 0;
  },
});

const results = await countAnimalLegsEval.run(countAnimalLegs);
```
