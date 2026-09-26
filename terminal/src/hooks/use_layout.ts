import { useStdout } from "ink";
import { useEffect, useState } from "react";

export interface Layout {
  cols: number;
  rows: number;
  chat_width: number;
  task_width: number;
  chat_height: number;
}

export function useLayout(): Layout {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ cols: stdout.columns, rows: stdout.rows });

  useEffect(() => {
    const handler = () => setSize({ cols: stdout.columns, rows: stdout.rows });
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  const cols = size.cols || 120;
  const rows = size.rows || 30;
  const task_width = Math.floor(cols * 0.35);
  const chat_width = cols - task_width - 1;
  const chat_height = rows - 4; // minus footer + prompt

  return { cols, rows, chat_width, task_width, chat_height };
}
