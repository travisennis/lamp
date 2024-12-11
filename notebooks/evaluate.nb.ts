import { generateText } from "ai";
// %%
import { z } from "zod";
import { lampEval } from "../source/evaluate.ts";
import { lamp } from "../source/lamp.ts";
import { model } from "../source/providers.ts";

// %%
const getFruit = lamp(
  { model: "anthropic:haiku", maxTokens: 256, temperature: 1.0 },
  (n: number, color: string) => {
    return `Generate ${String(n)} kinds of ${color} fruit as a comma-separated list.`;
  },
);

// const b = await getFruit(4, "red");
// console.log(b);

// %%
const getListOfFruit = lamp(
  {
    model: "anthropic:sonnet",
    schema: z.object({ fruits: z.array(z.string()) }),
    maxTokens: 256,
    temperature: 1.0,
  },
  (n: number) => {
    return `Generate ${String(n)} kinds of fruit.`;
  },
);

// const a = await getListOfFruit(5);
// console.dir(a);

// %%
const e = lampEval<typeof getFruit>({
  iterations: 2,
  testCases: [
    { input: [3, "red"], output: "" },
    // { input: [5, "yellow"], output: "" },
    // { input: [10, "green"], output: "" },
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

// await runEvaluation();
// %%
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

// %%
const countAnimalLegs = lamp(
  {
    model: "anthropic:haiku",
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

// %%
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

// %%
const results = await countAnimalLegsEval.run(countAnimalLegs);
// %%
results.scores.values.reduce((p, c) => p + c, 0) / results.scores.values.length;
// %%
const outputs = results.responses.map((r) => r.text);
const expected = results.testCases.map((t) => t.output);
const inputs = results.testCases.map((t) => t.input[0]);

const d = inputs.map((input, idx) => {
  return [
    input,
    results.responses[idx].template,
    results.responses[idx].prompt,
    expected[idx],
    outputs[idx],
    results.scores.values[idx],
  ];
});
d;
// %%
const errs = d.filter((a) => a.at(-1) === 0);
errs;
// %%
const { text } = await generateText({
  model: model("anthropic:sonnet"),
  prompt: `I'm trying to optimize my prompt. The current prompt template is:
  <prompt>
  ${errs[0][1]}
  </prompt>

  This is the first usage of this prompt:
  ${errs[0][2]}
  The expected answer is ${errs[0][3]}, but the model returned ${errs[0][4]}.

  This is the second usage of this prompt:
  ${errs[1][2]}
  The expected answer is ${errs[1][3]}, but the model returned ${errs[1][4]}.

  Provided an updated prompt between <new-prompt> tags that would correct these errors.
 `,
});

text;

// %%
// console.log(text);
const r = text.match(/<new-prompt>([\s\S]*?)<\/new-prompt>/)[1].trim();
console.log(r);
