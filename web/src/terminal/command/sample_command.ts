import { isCommand } from "./command_list";
import type { SampleScenario } from "./sample_scenarios";
import { SAMPLE_SCENARIOS } from "./sample_scenarios";

export type SampleOption = {
  value: string;
  label: string;
  scenario: SampleScenario;
};

export type SampleStep = {
  label: string;
  prompt: string;
};

export function isSampleCommand(input: string): boolean {
  return isCommand(input, "/sample");
}

export function loadSampleOptions(): SampleOption[] {
  return SAMPLE_SCENARIOS.map((scenario) => ({
    value: scenario.id,
    label: scenario.title,
    scenario,
  }));
}

export function buildSampleSteps(scenario: SampleScenario): SampleStep[] {
  const seed: SampleStep = { label: "seed — create the task graph", prompt: scenario.seed };
  const morphs: SampleStep[] = scenario.morphs.map((morph, index) => ({
    label: `morph ${index + 1} — ${morph.label}`,
    prompt: morph.prompt,
  }));
  return [seed, ...morphs];
}
