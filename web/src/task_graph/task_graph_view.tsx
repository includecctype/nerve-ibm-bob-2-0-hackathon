import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { TaskCategoryDTO } from "../terminal/dto/wire";
import "../styles/task_graph.css";
import { buildTaskMermaid } from "./task_mermaid";
import { TaskFooter } from "./task_footer";
import { useTaskUpdates } from "./use_task_updates";

type SvgRender = (text: string, options?: Record<string, unknown>) => string;

const GRAPH_OPTIONS = {
  bg: "var(--tgraph-bg)",
  fg: "var(--tgraph-fg)",
  line: "var(--tgraph-line)",
  accent: "var(--tgraph-accent)",
  muted: "var(--tgraph-muted)",
  border: "var(--tgraph-border)",
  transparent: true,
  padding: 24,
};

const ANIM_MS = 700;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const TOOLTIP_MAX_W = 300;

function marker(status: string): string {
  switch (status) {
    case "done":
      return "✓";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    case "running":
      return "▶";
    default:
      return "·";
  }
}

function flash(element: Element, class_name: string): void {
  element.classList.remove(class_name);
  void element.getBoundingClientRect();
  element.classList.add(class_name);
  window.setTimeout(() => element.classList.remove(class_name), ANIM_MS);
}

export function TaskGraphView() {
  const categories = useTaskUpdates();
  const [render, setRender] = useState<SvgRender | null>(null);
  const [load_error, setLoadError] = useState<string | null>(null);
  const root_ref = useRef<HTMLDivElement | null>(null);
  const body_ref = useRef<HTMLDivElement | null>(null);
  const canvas_ref = useRef<HTMLDivElement | null>(null);
  const prev_ref = useRef<TaskCategoryDTO[] | null>(null);
  const drag_ref = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    import("beautiful-mermaid")
      .then((mod) => {
        if (active) {
          setRender(() => mod.renderMermaidSVG as unknown as SvgRender);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Wheel zoom needs a non-passive listener to preventDefault.
  useEffect(() => {
    const body = body_ref.current;
    if (!body) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((prev) => ({
        ...prev,
        scale: Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * (event.deltaY < 0 ? 1.1 : 0.9)),
        ),
      }));
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, []);

  const graph = useMemo(() => buildTaskMermaid(categories), [categories]);

  const rendered = useMemo(() => {
    if (!render || categories.length === 0) {
      return { svg: null as string | null, error: null as string | null };
    }
    try {
      return { svg: render(graph.code, GRAPH_OPTIONS), error: null as string | null };
    } catch (cause) {
      return {
        svg: null as string | null,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [render, graph, categories.length]);

  // Inject the SVG and decorate nodes/edges with status classes + animations.
  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) {
      prev_ref.current = categories;
      return;
    }
    canvas.innerHTML = rendered.svg ?? "";

    const prev = prev_ref.current;
    const is_first = prev === null;
    const prev_by_name = new Map((prev ?? []).map((c) => [c.name, c]));
    const name_to_id = new Map<string, string>();
    for (const [id, name] of graph.idToName) {
      name_to_id.set(name, id);
    }

    if (rendered.svg) {
      for (const category of categories) {
        const id = name_to_id.get(category.name);
        if (!id) {
          continue;
        }
        const node = canvas.querySelector(`.node[data-id="${id}"]`);
        if (!node) {
          continue;
        }
        node.classList.add(`tgraph-status-${category.status}`);
        const before = prev_by_name.get(category.name);
        const changed = !is_first && (!before || before.status !== category.status);
        if (!is_first && !before) {
          flash(node, "tgraph-enter");
        } else if (changed) {
          flash(node, "tgraph-pulse");
        }
        if (changed) {
          for (const edge of canvas.querySelectorAll(`.edge[data-to="${id}"]`)) {
            flash(edge, "tgraph-enter");
          }
        }
      }
    }

    prev_ref.current = categories;
  }, [rendered.svg, categories, graph]);

  const hover_category = hover ? (categories.find((c) => c.name === hover.name) ?? null) : null;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag_ref.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = drag_ref.current;
    if (drag) {
      setView((prev) => ({
        ...prev,
        x: drag.vx + (event.clientX - drag.x),
        y: drag.vy + (event.clientY - drag.y),
      }));
      return;
    }
    const node = (event.target as Element).closest?.("g.node");
    const id = node?.getAttribute("data-id") ?? null;
    const name = id ? graph.idToName.get(id) : undefined;
    const root = root_ref.current;
    if (name && root) {
      const rect = root.getBoundingClientRect();
      const x = Math.min(event.clientX - rect.left + 12, Math.max(0, rect.width - TOOLTIP_MAX_W));
      const y = event.clientY - rect.top + 12;
      setHover({ name, x, y });
      return;
    }
    setHover(null);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag_ref.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const show_empty = categories.length === 0;
  const show_error = !show_empty && (load_error ?? rendered.error);

  return (
    <div className="task-graph" ref={root_ref}>
      <div className="task-graph-header">
        <span className="task-graph-title">Task graph</span>
        <span className="task-graph-hint">drag · scroll to zoom · hover a node</span>
      </div>
      <div
        className="task-graph-body"
        ref={body_ref}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          drag_ref.current = null;
          setHover(null);
        }}
      >
        {show_empty ? (
          <div className="task-graph-empty">No tasks yet</div>
        ) : show_error ? (
          <div className="task-graph-error">{show_error}</div>
        ) : rendered.svg === null ? (
          <div className="task-graph-empty">Loading graph…</div>
        ) : (
          <div
            className="tgraph-canvas"
            ref={canvas_ref}
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          />
        )}
      </div>
      {hover && hover_category ? (
        <div className="tgraph-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="tgraph-tooltip-title">
            {marker(hover_category.status)} {hover_category.name}
          </div>
          {hover_category.tasks.length === 0 ? (
            <div className="tgraph-tooltip-empty">no tasks</div>
          ) : (
            hover_category.tasks.slice(0, 8).map((task, index) => (
              <div className="tgraph-tooltip-task" key={`${index}-${task.description}`}>
                {marker(task.status)} {task.description}
              </div>
            ))
          )}
        </div>
      ) : null}
      <TaskFooter />
    </div>
  );
}
