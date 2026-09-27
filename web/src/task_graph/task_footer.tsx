import { useModelLabel } from "./use_model_label";

const WORKSPACE_LABEL = "WEB WORKSPACE";

export function TaskFooter() {
  const model_label = useModelLabel();

  return (
    <footer className="task-graph-footer">
      <div className="task-footer-brand">NERVE</div>
      <div className="task-footer-path">{WORKSPACE_LABEL}</div>
      <div className="task-footer-model">{model_label}</div>
    </footer>
  );
}
