import type { LMPFunctionResult } from "./lamp.ts";

interface StatisticsResult {
  average: number;
  median: number;
  std: number;
  max: number;
  min: number;
}

function describe(numbers: number[]): StatisticsResult {
  if (numbers.length === 0) {
    throw new Error("Input array is empty");
  }

  // Sort the array
  const sortedNumbers = [...numbers].sort((a, b) => a - b);

  // Calculate average
  const sum = sortedNumbers.reduce((acc, val) => acc + val, 0);
  const average = sum / sortedNumbers.length;

  // Calculate median
  const middle = Math.floor(sortedNumbers.length / 2);
  const median =
    sortedNumbers.length % 2 === 0
      ? (sortedNumbers[middle - 1] + sortedNumbers[middle]) / 2
      : sortedNumbers[middle];

  // Calculate standard deviation
  const squaredDifferences = sortedNumbers.map((num) => (num - average) ** 2);
  const variance =
    squaredDifferences.reduce((acc, val) => acc + val, 0) /
    sortedNumbers.length;
  const std = Math.sqrt(variance);

  // Get max and min
  const max = sortedNumbers[sortedNumbers.length - 1];
  const min = sortedNumbers[0];

  return {
    average,
    median,
    std,
    max,
    min,
  };
}

// Partial<Awaited<ReturnType<T>>>
type EvalConfig<P extends any[], R> = {
  iterations?: number;
  testCases?: {
    input: P;
    output: string;
  }[];
  evaluator?: (
    testCase: { input: P; output: string },
    response: R,
  ) => number | Promise<number>;
  benchmark?: boolean;
};

export type EvalResult<P> = {
  scores: {
    values: number[];
  } & StatisticsResult;
  executionTimes: {
    values: number[];
  } & StatisticsResult;
  promptTokens: {
    values: number[];
  } & StatisticsResult;
  completionTokens: {
    values: number[];
  } & StatisticsResult;
  responses: LMPFunctionResult<any>[];
  testCases: { input: P; output: string }[];
};

class Evaluator<
  T extends (...args: any[]) => Promise<LMPFunctionResult<any>>,
  P extends any[],
  R,
> {
  private config: Required<EvalConfig<P, R>>;

  constructor(config: EvalConfig<P, R>) {
    this.config = {
      iterations: 1,
      testCases: [],
      evaluator: () => 0,
      benchmark: false,
      ...config,
    };
  }

  async run(fn: T): Promise<EvalResult<P>> {
    const scores: number[] = [];
    const responses: LMPFunctionResult<any>[] = [];
    const testCases: { input: P; output: string }[] =
      this.config.testCases.length > 0 ? this.config.testCases : []; // Use empty array if no test cases provided
    const promptTokens: number[] = [];
    const responseTokens: number[] = [];
    const executionTimes: number[] = [];

    for (const testCase of testCases) {
      for (let i = 0; i < this.config.iterations; i++) {
        const startTime = performance.now();
        const result = await fn(...testCase.input);
        const endTime = performance.now();

        responses.push(result);
        promptTokens.push(result.usage.promptTokens);
        responseTokens.push(result.usage.completionTokens);

        if (this.config.benchmark) {
          executionTimes.push(endTime - startTime);
        }

        const score = await this.config.evaluator(testCase, result as R);
        scores.push(score);
      }
    }

    return {
      responses,
      testCases,
      scores: {
        values: scores,
        ...describe(scores),
      },
      executionTimes: {
        values: executionTimes,
        ...describe(executionTimes),
      },
      promptTokens: {
        values: promptTokens,
        ...describe(promptTokens),
      },
      completionTokens: {
        values: responseTokens,
        ...describe(responseTokens),
      },
    };
  }
}

export function lampEval<
  T extends (...args: any[]) => Promise<LMPFunctionResult<any>>,
>(
  config: EvalConfig<Parameters<T>, Awaited<ReturnType<T>>>,
): Evaluator<T, Parameters<T>, Awaited<ReturnType<T>>> {
  return new Evaluator<T, Parameters<T>, Awaited<ReturnType<T>>>(config);
}
