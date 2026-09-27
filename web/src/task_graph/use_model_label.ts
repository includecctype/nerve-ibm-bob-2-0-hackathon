import { useEffect, useState } from "react";
import { getModelLabel } from "../terminal/command/model_command";
import { user_data } from "../terminal/session/user_data";

const POLL_MS = 1000;

function currentLabel(): string {
  return user_data ? getModelLabel(user_data.main_agent_id) : "—";
}

/**
 * The model label shown in the graph-pane footer. user_data is mutated outside
 * React (by the terminal command layer), so poll it to pick up /model switches.
 */
export function useModelLabel(): string {
  const [label, setLabel] = useState<string>(currentLabel);

  useEffect(() => {
    const timer = setInterval(() => setLabel(currentLabel()), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return label;
}
