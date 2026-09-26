import { FullScreenBox, useScreenSize, withFullScreen } from "fullscreen-ink";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCommands, isSlashCommand } from "./command/command_list";
import type { CommandMode } from "./command/command_mode";
import { exitApp, isExitCommand } from "./command/exit_command";
import { applyApiKeyChange, isKeyCommand } from "./command/key_command";
import {
  getModelLabel,
  hasApiKeyForModel,
  isModelCommand,
  persistModelChoice,
} from "./command/model_command";
import { buildModelSelectOptions } from "./command/model_options";
import { QuestionnaireBox } from "./command/questionnaire_box";
import { isRestartCommand, restartConnection } from "./command/restart_command";
import {
  applySessionChoice,
  isSessionCommand,
  loadSessionOptions,
  startNewSession,
} from "./command/session_command";
import { SuggestionBox } from "./command/suggestion_box";
import type {
  DisplayHistoryDTO,
  QuestionnaireAnswerDTO,
  StructuredQuestionDTO,
  TaskCategoryDTO,
} from "./dto/wire";
import { useBracketedPaste } from "./hooks/use_bracketed_paste";
import { useLayout, WINDOW_PAD } from "./hooks/use_layout";
import { useMouseWheel } from "./hooks/use_mouse_wheel";
import { readConfig } from "./save/config_reader";
import { saveDisplayHistory, writeUserDataToFile } from "./save/config_writer";
import { ensureConfigFile } from "./save/create_config_file";
import { setUserData, user_data } from "./session/user_data";
import { connectSocket } from "./socket/client";
import { emitQuestionnaireAnswers, emitUserPrompt } from "./socket/emitters";
import {
  onConnectionStatus,
  onDisplay,
  onError,
  onQuestionnaire,
  onSubagentResponse,
  onTaskUpdate,
} from "./socket/handler_registry";
import { MODEL_OPTIONS } from "./systemconfig/model";
import { ChatViewport } from "./ui/chat_viewport";
import { CommandOverlay } from "./ui/command_overlay";
import { QUESTION_PREFIX } from "./ui/display_entry";
import { LogoView } from "./ui/logo_view";
import { PromptBox } from "./ui/prompt_box";
import { buildTaskLines, TaskPane } from "./ui/task_pane";
import {
  displayRowsFromEntries,
  flattenDisplayEntries,
  groupRowsIntoBlocks,
  windowFromBottom,
  windowFromTop,
} from "./ui/text_window";
import { BG_BLACK, BG_PANEL } from "./ui/theme";
import "./socket/listener";

const PROMPT_PLACEHOLDER = "SPAM your prompts here... (or /model, /session)";

function App() {
  const [logo_show, setLogoShow] = useState(true);

  const [displays, setDisplays] = useState<DisplayHistoryDTO[]>([]);
  const [tasks, setTasks] = useState<TaskCategoryDTO[]>([]);
  const [display_scroll, setDisplayScroll] = useState(0);
  const [task_scroll, setTaskScroll] = useState(0);
  const [, setConnectionStatus] = useState<boolean>(false);

  const [questions, setQuestions] = useState<StructuredQuestionDTO[]>([]);
  const [current_question, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswerDTO[]>([]);
  const [questionnaire_free_text, setQuestionnaireFreeText] = useState(false);
  const [questionnaire_draft, setQuestionnaireDraft] = useState("");
  const questions_ref = useRef<StructuredQuestionDTO[]>([]);
  const questionnaire_active = questions.length > 0 && current_question < questions.length;

  const [command_mode, setCommandMode] = useState<CommandMode>({
    type: "none",
  });

  const [input_value, setInputValue] = useState("");
  const [selected_idx, setSelectedIdx] = useState(0);
  const [input_key, setInputKey] = useState(0);

  const { height: screen_height, width: screen_width } = useScreenSize();

  const command_matches =
    command_mode.type === "none" && !questionnaire_active ? filterCommands(input_value) : [];
  const suggestion_open = command_matches.length > 0;

  const {
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
  } = useLayout({
    screen_width,
    screen_height,
    command_matches,
    questionnaire_active,
    questions,
    current_question,
    input_value,
    questionnaire_free_text,
    questionnaire_draft,
  });

  const status_cwd = process.cwd();
  const status_model_label = user_data ? getModelLabel(user_data.main_agent_id) : "—";

  useEffect(() => {
    questions_ref.current = questions;
  }, [questions]);

  const chat_lines = useMemo(
    () => flattenDisplayEntries(displays, entry_content_width),
    [displays, entry_content_width],
  );
  const chat_rows = useMemo(() => displayRowsFromEntries(chat_lines), [chat_lines]);

  const task_lines = useMemo(
    () => buildTaskLines(tasks, task_text_width),
    [tasks, task_text_width],
  );

  const chat_window = windowFromBottom(
    chat_rows,
    display_viewport_rows - (display_scroll > 0 ? 1 : 0),
    display_scroll,
  );
  const chat_blocks = groupRowsIntoBlocks(chat_window.visible);
  const task_window = windowFromTop(task_lines, task_viewport_rows, task_scroll);

  const scrollChat = (delta: number) => {
    setDisplayScroll((prev) => Math.max(0, Math.min(chat_window.maxScroll, prev + delta)));
  };
  const scrollTasks = (delta: number) => {
    setTaskScroll((prev) => Math.max(0, Math.min(task_window.maxScroll, prev + delta)));
  };

  const cancelActiveCommand = () => {
    setCommandMode({ type: "none" });
    setLogoShow(false);
    setInputValue("");
    setSelectedIdx(0);
    setInputKey((prev) => prev + 1);
  };

  useInput(
    (input, key) => {
      void input;
      if (key.escape && questionnaire_free_text) {
        setQuestionnaireFreeText(false);
        setQuestionnaireDraft("");
        return;
      }
      if (key.escape && command_mode.type !== "none") {
        cancelActiveCommand();
        return;
      }
      if (suggestion_open) {
        if (key.upArrow) {
          setSelectedIdx((prev) => (prev <= 0 ? command_matches.length - 1 : prev - 1));
        } else if (key.downArrow) {
          setSelectedIdx((prev) => (prev >= command_matches.length - 1 ? 0 : prev + 1));
        } else if (key.tab) {
          const entry = command_matches[selected_idx];
          if (entry) {
            setInputValue(entry.name);
            setInputKey((prev) => prev + 1);
          }
        }
        return;
      }
      if (command_mode.type !== "none" || logo_show || questionnaire_active) {
        return;
      }

      if (key.ctrl && key.upArrow) {
        scrollTasks(-1);
      } else if (key.ctrl && key.downArrow) {
        scrollTasks(1);
      } else if (key.pageUp) {
        scrollChat(display_viewport_rows);
      } else if (key.pageDown) {
        scrollChat(-display_viewport_rows);
      } else if (key.home) {
        scrollChat(chat_window.maxScroll);
      } else if (key.end) {
        scrollChat(-chat_window.maxScroll);
      } else if (key.upArrow) {
        if (prompt_scrollable) return;
        scrollChat(1);
      } else if (key.downArrow) {
        if (prompt_scrollable) return;
        scrollChat(-1);
      }
    },
    { isActive: true },
  );

  useBracketedPaste();
  useMouseWheel(!logo_show, (direction, x) => {
    if (command_mode.type !== "none") {
      return;
    }
    const over_tasks = show_task_bar && x > chat_pane_width;
    const delta = direction === "up" ? 3 : -3;
    if (over_tasks) {
      scrollTasks(-delta);
    } else {
      scrollChat(delta);
    }
  });

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSelectedIdx(0);
  };

  const completeToSelectedCommand = (value: string): string => {
    if (!value.startsWith("/")) return value;
    const exact = command_matches.find((entry) => entry.name === value);
    if (exact) return exact.name;
    const selected = command_matches[selected_idx] ?? command_matches[0];
    return selected ? selected.name : value;
  };

  // if someone press something like control+c
  // init: ensure config → read → connect
  useEffect(() => {
    const flushAndExit = async () => {
      try {
        await writeUserDataToFile();
      } finally {
        process.exit(0);
      }
    };
    process.on("SIGINT", flushAndExit);
    process.on("SIGTERM", flushAndExit);

    (async () => {
      await ensureConfigFile();
      const data = await readConfig();
      setUserData(data);
      setTasks(user_data?.categories ?? []);
      setDisplayScroll(0);
      setTaskScroll(0);
      connectSocket();
    })();

    return () => {
      process.off("SIGINT", flushAndExit);
      process.off("SIGTERM", flushAndExit);
    };
  }, []);

  // assign
  useEffect(() => {
    onDisplay((entry) => {
      setDisplays((prev) => [...prev, entry]);
    });
    onTaskUpdate(() => {
      setTasks(user_data?.categories ?? []);
    });
    // Display-only progress line — sub-agent reports never reach the main agent.
    onSubagentResponse((data) => {
      const entry: DisplayHistoryDTO = {
        role: "system",
        content: `${data.status === "done" ? "✓" : "✗"} [${data.category}] ${data.report}`,
      };
      saveDisplayHistory(entry);
      setDisplays((prev) => [...prev, entry]);
    });
    onConnectionStatus((connected) => {
      setConnectionStatus(connected);
      if (!connected) {
        setDisplays((prev) => [
          ...prev,
          {
            role: "system",
            content: "Cannot connect to model — set API key with /model",
          },
        ]);
      }
    });
    onQuestionnaire((qs) => {
      // A duplicate emit of the same questions must not wipe the write-in box.
      const prev = questions_ref.current;
      if (
        prev.length > 0 &&
        prev.length === qs.length &&
        JSON.stringify(prev) === JSON.stringify(qs)
      ) {
        return;
      }
      questions_ref.current = qs;
      setQuestions(qs);
      setCurrentQuestion(0);
      setAnswers([]);
      setQuestionnaireFreeText(false);
      setQuestionnaireDraft("");
    });
    onError((message) => {
      setDisplays((prev) => [...prev, { role: "error", content: message }]);
    });
  }, []);

  const appendSystemNote = (content: string) => {
    setDisplays((prev) => [...prev, { role: "system", content }]);
  };

  const finishModelSwitch = async (model_id: number, api_key: string) => {
    await persistModelChoice(model_id, api_key);
    appendSystemNote(`Switched model to ${getModelLabel(model_id)} (id=${model_id})`);
    setCommandMode({ type: "none" });
    setLogoShow(false);
    setInputValue("");
    setSelectedIdx(0);
    setInputKey((prev) => prev + 1);
  };

  const handleModelSelect = async (value: string) => {
    const option = buildModelSelectOptions().find((o) => o.value === value);
    if (!option) return;
    const model = MODEL_OPTIONS.find((m) => m.id === option.modelId);
    if (!model) return;

    if (hasApiKeyForModel(model.id)) {
      const existing_key = user_data?.api_keys[model.id];
      if (existing_key) {
        await finishModelSwitch(model.id, existing_key);
      }
    } else {
      setCommandMode({
        type: "enter_api_key",
        modelId: model.id,
        modelLabel: model.label,
        flow: "model",
      });
    }
  };

  const handleKeyModelSelect = (value: string) => {
    const option = buildModelSelectOptions().find((o) => o.value === value);
    if (!option) return;
    const model = MODEL_OPTIONS.find((m) => m.id === option.modelId);
    if (!model) return;
    setCommandMode({
      type: "enter_api_key",
      modelId: model.id,
      modelLabel: model.label,
      flow: "key",
    });
  };

  const handleApiKeySubmit = async (value: string) => {
    if (command_mode.type !== "enter_api_key") return;
    const trimmed = value.trim();
    if (!trimmed) {
      appendSystemNote(
        `API key cannot be empty. Try ${command_mode.flow === "key" ? "/key" : "/model"} again.`,
      );
      setCommandMode({ type: "none" });
      return;
    }
    if (command_mode.flow === "key") {
      await applyApiKeyChange(command_mode.modelId, trimmed);
      appendSystemNote(`Updated API key for ${command_mode.modelLabel}`);
      setCommandMode({ type: "none" });
    } else {
      await finishModelSwitch(command_mode.modelId, trimmed);
    }
    setInputValue("");
    setSelectedIdx(0);
    setInputKey((prev) => prev + 1);
  };

  const finishSessionSwitch = () => {
    setCommandMode({ type: "none" });
    setLogoShow(false);
    setInputValue("");
    setSelectedIdx(0);
    setInputKey((prev) => prev + 1);
  };

  const handleSessionSelect = async (value: string) => {
    if (command_mode.type !== "select_session") return;
    const option = command_mode.sessions.find((s) => s.value === value);
    if (!option) return;

    if (option.session_id === null || !option.data) {
      await startNewSession();
      setDisplays([]);
      setTasks([]);
      setDisplayScroll(0);
      setTaskScroll(0);
      appendSystemNote("Started new session");
    } else {
      await applySessionChoice(option.session_id, option.data);
      setDisplays(option.data.history);
      setTasks(user_data?.categories ?? []);
      setDisplayScroll(0);
      setTaskScroll(0);
      appendSystemNote(`Loaded session ${option.session_id}`);
    }
    finishSessionSwitch();
  };

  const handlePromptSubmit = (value: string) => {
    const trimmed = completeToSelectedCommand(value.trim());
    setInputValue("");
    setSelectedIdx(0);
    setInputKey((prev) => prev + 1);

    if (command_mode.type === "none" && isModelCommand(trimmed)) {
      appendSystemNote("/model — choose a model");
      setCommandMode({ type: "select_model" });
      setLogoShow(false);
      return;
    }

    if (command_mode.type === "none" && isKeyCommand(trimmed)) {
      appendSystemNote("/key — choose a model to update its API key");
      setCommandMode({ type: "select_key_model" });
      setLogoShow(false);
      return;
    }

    if (command_mode.type === "none" && isSessionCommand(trimmed)) {
      appendSystemNote("/session — choose a session");
      setLogoShow(false);
      void (async () => {
        const sessions = await loadSessionOptions();
        const saved_count = sessions.filter((s) => s.session_id !== null).length;
        if (saved_count === 0) {
          appendSystemNote("No saved sessions, starting fresh");
        }
        setCommandMode({ type: "select_session", sessions });
      })();
      return;
    }

    if (command_mode.type === "none" && isExitCommand(trimmed)) {
      void exitApp();
      return;
    }

    if (command_mode.type === "none" && isRestartCommand(trimmed)) {
      void (async () => {
        await restartConnection();
        setDisplays([]);
        setTasks([]);
        setDisplayScroll(0);
        setTaskScroll(0);
        setQuestions([]);
        setAnswers([]);
        setCurrentQuestion(0);
        setQuestionnaireFreeText(false);
        setQuestionnaireDraft("");
        setCommandMode({ type: "none" });
        setLogoShow(true);
        setInputValue("");
        setSelectedIdx(0);
        setInputKey((prev) => prev + 1);
      })();
      return;
    }

    if (command_mode.type === "none" && isSlashCommand(trimmed)) {
      appendSystemNote(
        `Unknown command: ${trimmed}. Try /model, /key, /session, /exit, or /restart`,
      );
      setLogoShow(false);
      return;
    }

    if (trimmed) {
      emitUserPrompt(trimmed);
      setDisplays((prev) => [...prev, { role: "user", content: trimmed }]);
    }
    setLogoShow(false);
  };

  const handleQuestionnaireSelect = (value: string) => {
    if (!questionnaire_active) return;
    const q = questions[current_question];
    const updated: QuestionnaireAnswerDTO[] = [...answers, { question: q.question, answer: value }];

    setQuestionnaireFreeText(false);
    setQuestionnaireDraft("");

    if (current_question + 1 >= questions.length) {
      emitQuestionnaireAnswers(updated);
      for (const a of updated) {
        const entry: DisplayHistoryDTO = {
          role: "system",
          content: `${QUESTION_PREFIX}${a.question}\nA: ${a.answer}`,
        };
        setDisplays((prev) => [...prev, entry]);
        saveDisplayHistory(entry);
      }
      setQuestions([]);
      setAnswers([]);
      setCurrentQuestion(0);
      return;
    }

    setAnswers(updated);
    setCurrentQuestion((prev) => prev + 1);
  };

  const handleQuestionnaireOther = () => {
    if (!questionnaire_active) return;
    setQuestionnaireDraft("");
    setQuestionnaireFreeText(true);
  };

  const handleQuestionnaireDraftSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    handleQuestionnaireSelect(trimmed);
  };

  const command_active = command_mode.type !== "none";

  const command_overlay = (
    <CommandOverlay
      commandMode={command_mode}
      screenWidth={inner_width}
      screenHeight={inner_height}
      onModelSelect={(val) => {
        void handleModelSelect(val);
      }}
      onKeyModelSelect={handleKeyModelSelect}
      onSessionSelect={(val) => {
        void handleSessionSelect(val);
      }}
      onApiKeySubmit={(val) => {
        void handleApiKeySubmit(val);
      }}
    />
  );

  if (!logo_show) {
    return (
      <FullScreenBox
        flexDirection="row"
        display="flex"
        backgroundColor={BG_BLACK}
        padding={WINDOW_PAD}
      >
        <Box
          width={chat_pane_width}
          height="100%"
          flexDirection="column"
          display="flex"
          marginRight={chat_gap}
        >
          <ChatViewport
            chatBlocks={chat_blocks}
            displayScroll={display_scroll}
            viewportRows={display_viewport_rows}
          />
          {suggestion_open && (
            <SuggestionBox commands={command_matches} selectedIndex={selected_idx} />
          )}
          {questionnaire_active && (
            <QuestionnaireBox
              question={questions[current_question]}
              current={current_question}
              total={questions.length}
              onSelect={handleQuestionnaireSelect}
              freeText={questionnaire_free_text}
              onOther={handleQuestionnaireOther}
            />
          )}
          <Box
            width="100%"
            height={prompt_box_height}
            display="flex"
            flexDirection="column"
            flexShrink={0}
          >
            {questionnaire_active && questionnaire_free_text ? (
              <PromptBox
                key={`q-other-${current_question}`}
                value={questionnaire_draft}
                onChange={setQuestionnaireDraft}
                onSubmit={handleQuestionnaireDraftSubmit}
                placeholder="Type your answer… (Esc to go back)"
                width={chat_content_width}
                maxContentRows={prompt_max_rows}
                bordered={true}
              />
            ) : questionnaire_active ? (
              <Box width="100%" display="flex" backgroundColor={BG_PANEL} paddingX={1} paddingY={1}>
                <Text dimColor>Answer the question above…</Text>
              </Box>
            ) : command_active ? (
              <Box width="100%" display="flex" backgroundColor={BG_PANEL} paddingX={1} paddingY={1}>
                <Text dimColor>Esc to cancel…</Text>
              </Box>
            ) : (
              <PromptBox
                key={input_key}
                value={input_value}
                onChange={handleInputChange}
                onSubmit={handlePromptSubmit}
                placeholder={PROMPT_PLACEHOLDER}
                width={chat_content_width}
                maxContentRows={prompt_max_rows}
                bordered={true}
              />
            )}
          </Box>
        </Box>
        {show_task_bar && (
          <TaskPane
            taskWindow={task_window}
            taskScroll={task_scroll}
            taskGutterWidth={task_gutter_width}
            width={task_pane_width}
            cwd={status_cwd}
            modelLabel={status_model_label}
          />
        )}
        {command_overlay}
      </FullScreenBox>
    );
  }

  return (
    <LogoView
      innerWidth={inner_width}
      logoPromptWidth={logo_prompt_width}
      promptMaxRows={prompt_max_rows}
      suggestionOpen={suggestion_open}
      commandMatches={command_matches}
      selectedIdx={selected_idx}
      questionnaireActive={questionnaire_active}
      question={questions[current_question]}
      currentQuestion={current_question}
      totalQuestions={questions.length}
      questionnaireFreeText={questionnaire_free_text}
      questionnaireDraft={questionnaire_draft}
      onQuestionnaireDraftChange={setQuestionnaireDraft}
      onQuestionnaireSelect={handleQuestionnaireSelect}
      onQuestionnaireOther={handleQuestionnaireOther}
      onQuestionnaireDraftSubmit={handleQuestionnaireDraftSubmit}
      inputKey={input_key}
      inputValue={input_value}
      promptPlaceholder={PROMPT_PLACEHOLDER}
      onInputChange={handleInputChange}
      onPromptSubmit={handlePromptSubmit}
      commandOverlay={command_overlay}
    />
  );
}

withFullScreen(<App />, {
  kittyKeyboard: { flags: ["disambiguateEscapeCodes"] },
}).start();
