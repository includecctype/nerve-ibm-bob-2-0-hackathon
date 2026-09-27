import { buildSampleSteps } from "./sample_command";
import type { SampleScenario } from "./sample_scenarios";

export const SAMPLE_SETTLE_MS = 2500;
export const SAMPLE_MAX_WAIT_MS = 25000;

export type SettleWaiter = {
  noteActivity: () => void;
  wait: (options: { isCancelled: () => boolean; isPaused: () => boolean }) => Promise<void>;
};

/**
 * Debounce helper for the sample player: the graph is considered settled once no
 * task_update / main_agent_response / subagent_response has arrived for
 * SAMPLE_SETTLE_MS, with a hard cap so a silent turn never hangs the sequence.
 */
export function createSettleWaiter(
  settleMs: number = SAMPLE_SETTLE_MS,
  maxMs: number = SAMPLE_MAX_WAIT_MS,
): SettleWaiter {
  let last_activity = Date.now();

  return {
    noteActivity: () => {
      last_activity = Date.now();
    },
    wait: ({ isCancelled, isPaused }) =>
      new Promise<void>((resolve) => {
        const started_at = Date.now();
        const timer = setInterval(() => {
          if (isCancelled()) {
            clearInterval(timer);
            resolve();
            return;
          }
          const quiet_for = Date.now() - last_activity;
          const waited_for = Date.now() - started_at;
          if (!isPaused() && (quiet_for >= settleMs || waited_for >= maxMs)) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      }),
  };
}

export type SamplePlayerHandlers = {
  sendPrompt: (prompt: string) => void;
  onStep: (step: { label: string; prompt: string }, index: number, total: number) => void;
  waitForSettle: () => Promise<void>;
  isCancelled: () => boolean;
};

/**
 * Send a scenario's seed prompt and then each morph prompt, waiting for the task
 * graph to settle in between. Stops early when cancelled (Esc, a manual prompt,
 * rate limiting, or a disconnect).
 */
export async function playSample(
  scenario: SampleScenario,
  handlers: SamplePlayerHandlers,
): Promise<"done" | "cancelled"> {
  const steps = buildSampleSteps(scenario);

  for (let index = 0; index < steps.length; index++) {
    if (handlers.isCancelled()) return "cancelled";
    const step = steps[index];
    handlers.onStep(step, index, steps.length);
    handlers.sendPrompt(step.prompt);
    await handlers.waitForSettle();
  }

  return handlers.isCancelled() ? "cancelled" : "done";
}
