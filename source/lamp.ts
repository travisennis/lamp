import {
	type LanguageModel,
	type Schema,
	generateObject,
	generateText,
} from "ai";
import type { z } from "zod";
import { writeHeader, writeln } from "./output.ts";

/**
 * Settings for configuring the language model behavior
 */
interface ModelSettings {
	/**
  Maximum number of tokens to generate.
     */
	maxTokens?: number;
	/**
  Temperature setting. This is a number between 0 (almost no randomness) and
  1 (very random).

  It is recommended to set either `temperature` or `topP`, but not both.

  @default 0
     */
	temperature?: number;
	/**
  Nucleus sampling. This is a number between 0 and 1.

  E.g. 0.1 would mean that only tokens with the top 10% probability mass
  are considered.

  It is recommended to set either `temperature` or `topP`, but not both.
     */
	topP?: number;
	/**
  Only sample from the top K options for each subsequent token.

  Used to remove "long tail" low probability responses.
  Recommended for advanced use cases only. You usually only need to use temperature.
     */
	topK?: number;
	/**
  Presence penalty setting. It affects the likelihood of the model to
  repeat information that is already in the prompt.

  The presence penalty is a number between -1 (increase repetition)
  and 1 (maximum penalty, decrease repetition). 0 means no penalty.
     */
	presencePenalty?: number;
	/**
  Frequency penalty setting. It affects the likelihood of the model
  to repeatedly use the same words or phrases.

  The frequency penalty is a number between -1 (increase repetition)
  and 1 (maximum penalty, decrease repetition). 0 means no penalty.
     */
	frequencyPenalty?: number;
	/**
  Stop sequences.
  If set, the model will stop generating text when one of the stop sequences is generated.
  Providers may have limits on the number of stop sequences.
     */
	stopSequences?: string[];
	/**
  The seed (integer) to use for random sampling. If set and supported
  by the model, calls will generate deterministic results.
     */
	seed?: number;
	/**
  Maximum number of retries. Set to 0 to disable retries.

  @default 2
     */
	maxRetries?: number;
	/**
  Abort signal.
     */
	abortSignal?: AbortSignal;
	/**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
     */
	headers?: Record<string, string | undefined>;

	debug?: boolean;
}

/**
 * Settings for configuring object generation with schema validation
 * @template OBJECT The type of object to be generated
 */
interface ObjectSettings<OBJECT> {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	schema?: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
}

/**
 * Usage statistics for a language model interaction
 */
export type Usage = {
	/**
  The number of tokens used in the prompt.
     */
	promptTokens: number;
	/**
  The number of tokens used in the completion.
   */
	completionTokens: number;
	/**
  The total number of tokens used (promptTokens + completionTokens).
     */
	totalTokens: number;
};

/**
 * Configuration for Language Model Processing
 * @template U The type of object to be generated (if using schema)
 */
export type LMPConfig<U = any> = { model: LanguageModel } & ModelSettings &
	ObjectSettings<U>;

/**
 * Result type for Language Model Processing functions
 * @template U The type of object that was generated (if using schema)
 */
export type LMPFunctionResult<U> = U extends never
	? {
			text: string;
			usage: Usage;
		}
	: { object: U; usage: Usage };

/**
 * Function type for generating prompts
 * @template T Array of argument types for the prompt function
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type LMPPromptFunction<T extends any[] = any[]> = (...args: T) =>
	| string
	| {
			system: string;
			prompt: string;
	  };

/**
 * Function type for Language Model Processing
 * @template T The prompt function type
 * @template U The type of object to be generated (if using schema)
 */
export type LMPFunction<T extends LMPPromptFunction, U = any> = (
	...args: Parameters<T>
) => Promise<LMPFunctionResult<U>>;

/**
 * Utility type to extract the response object type from an LMP result
 * @template T The LMP result type
 */
export type LMPResponseObject<T> = T extends { object: infer U } ? U : never;

/**
 * Creates a function that processes prompts using a language model
 * @template T The prompt function type
 * @param config Configuration for the language model
 * @param promptFn Function that generates the prompt
 * @returns A function that processes the prompt and returns text
 */
export function lamp<T extends LMPPromptFunction>(
	{ model, ...settings }: { model: LanguageModel } & ModelSettings,
	promptFn: T,
): (...args: Parameters<T>) => Promise<{
	text: string;
	usage: Usage;
}>;
/**
 * Creates a function that processes prompts using a language model and generates objects
 * @template T The prompt function type
 * @template U The type of object to be generated
 * @param config Configuration for the language model including schema
 * @param promptFn Function that generates the prompt
 * @returns A function that processes the prompt and returns an object
 */
export function lamp<T extends LMPPromptFunction, U>(
	{
		model,
		schema,
		...settings
	}: { model: LanguageModel } & ModelSettings & Required<ObjectSettings<U>>,
	promptFn: T,
): (...args: Parameters<T>) => Promise<{
	object: U;
	usage: Usage;
}>;
export function lamp<T extends LMPPromptFunction, U = never>(
	{
		model,
		schema,
		...settings
	}: { model: LanguageModel } & ModelSettings & ObjectSettings<U>, // & NSettings,
	promptFn: T,
): LMPFunction<T, U> {
	return async (...args: Parameters<T>): Promise<LMPFunctionResult<U>> => {
		const prompts = promptFn(...args);

		const { system, prompt } =
			typeof prompts === "string"
				? { system: undefined, prompt: prompts }
				: prompts;

		let result: { text?: string; object?: U; usage: Usage };
		if (schema) {
			result = await getObject<U>(model, system, prompt, schema, settings);
		} else {
			result = await getText(model, system, prompt, settings);
		}

		if (settings.debug) {
			logMessages({
				system,
				user: prompt,
				output: result.text ? result.text : JSON.stringify(result.object),
			});
		}

		return {
			...result,
		} as LMPFunctionResult<U>;
	};
}

/**
 * Generates an object using the language model with schema validation
 * @template U The type of object to be generated
 * @param model The language model to use
 * @param system Optional system message
 * @param prompt The prompt to send to the model
 * @param schema Schema for validating the generated object
 * @param settings Additional model settings
 * @returns The generated object and usage statistics
 */
async function getObject<U>(
	model: LanguageModel,
	system: string | undefined,
	prompt: string,
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	schema: z.Schema<U, z.ZodTypeDef, any> | Schema<U>,
	settings: ModelSettings,
) {
	const { object, usage } = await generateObject({
		model,
		system,
		prompt,
		schema,
		...settings,
	});

	return { object, usage };
}

/**
 * Generates text using the language model
 * @param model The language model to use
 * @param system Optional system message
 * @param prompt The prompt to send to the model
 * @param settings Additional model settings
 * @returns The generated text and usage statistics
 */
async function getText(
	model: LanguageModel,
	system: string | undefined,
	prompt: string,
	settings: ModelSettings,
) {
	const { text, usage } = await generateText({
		model,
		system,
		prompt,
		...settings,
	});

	return { text, usage };
}

/**
 * Logs the messages exchanged with the language model
 * @param params Object containing system message, user prompt, and model output
 */
function logMessages({
	system,
	user,
	output,
}: {
	system?: string;
	user: string;
	output: string;
}): void {
	writeHeader("Prompt:");
	if (system) {
		writeln(`\x1b[33msystem:\x1b[0m ${system}`);
		writeln("");
	}
	writeln(`\x1b[33muser:\x1b[0m ${user}`);
	writeHeader("Output:");
	writeln(output);
}
