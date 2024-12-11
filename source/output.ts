// Common ANSI colors:
// \x1b[31m = Red
// \x1b[32m = Green
// \x1b[33m = Yellow
// \x1b[34m = Blue
// \x1b[35m = Magenta
// \x1b[36m = Cyan
// \x1b[0m = Reset color}

/**
 * Writes a string to stdout followed by a newline character.
 * @param input The string to write to stdout
 * @returns void
 */
export function writeln(input: string): void {
  process.stdout.write(`${input}\n`);
}

/**
 * Writes an error message to stdout in red text with an X icon
 * @param input The error message to display
 */
export function writeError(input: string): void {
  process.stdout.write(`\x1b[31m✖️  ${input}\x1b[0m`);
}

/**
 * Writes a formatted header to stdout with optional chalk styling
 * @param header - The text to display in the header
 * @returns void
 */
export function writeHeader(header: string): void {
  const width = process.stdout.columns - header.length - 2;
  process.stdout.write(`\x1b[32m\n--${header}${"-".repeat(width)}\n`);
}

/**
 * Writes a horizontal line across the terminal width using specified chalk color
 * @returns {void}
 */
export function writehr(): void {
  process.stdout.write(`\x1b[36m\n${"-".repeat(process.stdout.columns)}\n`);
}
