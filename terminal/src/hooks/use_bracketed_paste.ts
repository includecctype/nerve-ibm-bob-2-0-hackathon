const PASTE_START = "\u001b[200~";
const PASTE_END = "\u001b[201~";

/**
 * Strips bracketed-paste markers and normalises CR→LF so multi-line paste
 * does not auto-submit the prompt.
 *
 * Ink delivers a whole paste as a single `input` event, so this only
 * normalises that string. No extra stdin listener is installed: Ink owns
 * stdin through its readable stream, so a second `data` listener would steal
 * input away from it.
 */
export function sanitizePastedInput(raw: string): string {
  let text = raw;
  if (text.includes(PASTE_START)) text = text.split(PASTE_START).join("");
  if (text.includes(PASTE_END)) text = text.split(PASTE_END).join("");
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Splits one raw input event into the printable text and a "the user pressed
 * Enter" flag.
 *
 * Ink only sets `key.return` when the event is exactly "\r", so a chunk such
 * as "/exit\r" (fast typing, piped input, coalesced reads) would otherwise be
 * pasted into the prompt as literal text. A trailing CR is the Enter key and
 * is consumed as a submit; a trailing LF (paste) is kept as content so
 * multi-line paste still does not submit.
 */
export function splitInputChunk(raw: string): { text: string; submitted: boolean } {
  if (raw.endsWith("\r")) {
    return { text: raw.replace(/\r+$/, ""), submitted: true };
  }
  return { text: raw, submitted: false };
}

/**
 * Returns the paste normaliser used by the input handlers.
 */
export function useBracketedPaste(): (raw: string) => string {
  return sanitizePastedInput;
}
