import type { SampleOption } from "./sample_command";
import type { SessionOption } from "./session_command";

export type CommandMode =
  | { type: "none" }
  | { type: "select_model" }
  | { type: "select_key_model" }
  | {
      type: "enter_api_key";
      modelId: number;
      modelLabel: string;
      flow: "model" | "key";
    }
  | { type: "select_session"; sessions: SessionOption[] }
  | { type: "select_sample"; samples: SampleOption[] };
