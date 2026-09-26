import { useStdout } from "ink";
import { useEffect, useState } from "react";
import type { CommandEntry } from "../command/command_list";
import { buildQuestionOptions } from "../command/questionnaire_box";
import type { StructuredQuestionDTO } from "../dto/wire";
import { promptContentRows, promptHiddenLineCount } from "../ui/prompt_box";
import { statusFooterRows } from "../ui/status_footer";
import { wrapLines } from "../ui/text_window";

export const LOGO_PROMPT_WIDTH = 60;
const MIN_TASK_W = 20;
const MAX_TASK_W = 40;
export const WINDOW_PAD = 1;

type LayoutParams = {
  screen_width: number;
  screen_height: number;
  command_matches: CommandEntry[];
  questionnaire_active: boolean;
  questions: StructuredQuestionDTO[];
  current_question: number;
  input_value: string;
  questionnaire_free_text: boolean;
  questionnaire_draft: string;
};

type Layout = {
  inner_width: number;
  inner_height: number;
  show_task_bar: boolean;
  task_pane_width: number;
  chat_gap: number;
  chat_pane_width: number;
  chat_content_width: number;
  task_gutter_width: number;
  task_text_width: number;
  logo_prompt_width: number;
  task_viewport_rows: number;
  prompt_max_rows: number;
  prompt_box_height: number;
  display_viewport_rows: number;
  prompt_scrollable: boolean;
  entry_content_width: number;
};

export function useLayout({
  screen_width,
  screen_height,
  command_matches,
  questionnaire_active,
  questions,
  current_question,
  input_value,
  questionnaire_free_text,
  questionnaire_draft,
}: LayoutParams): Layout {
  const inner_width = Math.max(1, screen_width - WINDOW_PAD * 2);
  const inner_height = Math.max(1, screen_height - WINDOW_PAD * 2);
  const show_task_bar = inner_width >= MIN_TASK_W;
  const task_pane_width = show_task_bar
    ? Math.min(MAX_TASK_W, Math.max(MIN_TASK_W, Math.floor(inner_width * 0.25)))
    : 0;
  const chat_gap = show_task_bar ? 1 : 0;
  const chat_pane_width = Math.max(1, inner_width - task_pane_width - chat_gap);

  const chat_border = 2;
  const chat_content_width = Math.max(1, chat_pane_width - chat_border);
  const task_gutter_width = 2;
  const task_content_width = Math.max(1, task_pane_width - chat_border);
  const task_text_width = Math.max(1, task_content_width - task_gutter_width);
  // PromptBox renders at width + 2 (its 1-char padding on each side).
  const logo_prompt_width = Math.max(3, Math.min(LOGO_PROMPT_WIDTH, inner_width - 2));
  const status_footer_height = show_task_bar ? statusFooterRows() : 0;
  const task_viewport_rows = Math.max(1, inner_height - 4 - status_footer_height);

  const suggestion_open = command_matches.length > 0;
  const suggestion_rows = suggestion_open
    ? 2 +
      command_matches.reduce(
        (n, e) => n + wrapLines(`${e.name} — ${e.description}`, chat_content_width).length,
        0,
      )
    : 0;
  const questionnaire_rows = questionnaire_active
    ? 2 +
      wrapLines(
        `Question ${current_question + 1}/${questions.length}: ${questions[current_question].question}`,
        chat_content_width,
      ).length +
      buildQuestionOptions(questions[current_question].options).length
    : 0;

  const prompt_max_rows = Math.min(10, Math.max(5, Math.floor(inner_height / 4)));
  const active_draft = questionnaire_active
    ? questionnaire_free_text
      ? questionnaire_draft
      : ""
    : input_value;
  const prompt_content_row_count = promptContentRows(
    active_draft,
    chat_content_width,
    prompt_max_rows,
  );
  const prompt_hidden_rows = promptHiddenLineCount(
    active_draft,
    chat_content_width,
    prompt_max_rows,
  );
  const prompt_box_height = prompt_content_row_count + 2 + (prompt_hidden_rows > 0 ? 1 : 0);

  const overflow_rows_raw = suggestion_rows + questionnaire_rows;
  const overflow_rows = Math.min(
    overflow_rows_raw,
    Math.max(0, inner_height - prompt_box_height - 3),
  );
  const display_viewport_rows = Math.max(1, inner_height - prompt_box_height - overflow_rows - 1);

  const prompt_scrollable =
    input_value.length > 0 && wrapLines(input_value, chat_content_width).length > 1;

  const entry_content_width = Math.max(1, chat_pane_width - 4);

  return {
    inner_width,
    inner_height,
    show_task_bar,
    task_pane_width,
    chat_gap,
    chat_pane_width,
    chat_content_width,
    task_gutter_width,
    task_text_width,
    logo_prompt_width,
    task_viewport_rows,
    prompt_max_rows,
    prompt_box_height,
    display_viewport_rows,
    prompt_scrollable,
    entry_content_width,
  };
}

export function useScreenSize(): { width: number; height: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    width: stdout.columns || 120,
    height: stdout.rows || 30,
  });

  useEffect(() => {
    const handler = () => setSize({ width: stdout.columns || 120, height: stdout.rows || 30 });
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  return size;
}
