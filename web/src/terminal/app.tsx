import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { filterCommands } from "./command/command_list.js";
import { KeyPrompt } from "./command/key_prompt.js";
import { ModelPicker } from "./command/model_picker.js";
import { QuestionnaireBox } from "./command/questionnaire_box.js";
import { type SessionEntry, SessionPicker } from "./command/session_picker.js";
import type {
  DisplayHistoryDTO,
  QuestionnaireAnswerDTO,
  StructuredQuestionDTO,
  TaskCategoryDTO,
  TaskUpdatePayload,
} from "./dto/wire.js";
import { useBracketedPaste } from "./hooks/use_bracketed_paste.js";
import { useLayout } from "./hooks/use_layout.js";
import { isMouseEvent, useMouseWheel } from "./hooks/use_mouse_wheel.js";
import {
  ensureConfigFile,
  readConfig,
  readSessionData,
  saveDisplayHistory,
  waitForWrites,
  writeUserDataToFile,
} from "./save/config_store.js";
import { commitSession, getUserData, setUserData } from "./session/user_data.js";
import { connectSocket, disconnectSocket } from "./socket/client.js";
import {
  emitAgentErrorResponse,
  emitQuestionnaireAnswers,
  emitUserPrompt,
} from "./socket/emitters.js";
import { attachHandlers } from "./socket/handler_registry.js";
import type { ListenerCallbacks } from "./socket/listener.js";
import { getModelLabel } from "./systemconfig/model.js";
import { ChatViewport } from "./ui/chat_viewport.js";
import { CommandOverlay } from "./ui/command_overlay.js";
import { LogoView } from "./ui/logo_view.js";
import { PromptBox } from "./ui/prompt_box.js";
import { StatusFooter } from "./ui/status_footer.js";
import { TaskPane } from "./ui/task_pane.js";
import { chatRows } from "./ui/text_window.js";
import { theme } from "./ui/theme.js";

// ── Bootstrap ──────────────────────────────────────────────────────────────
ensureConfigFile();
const stored_config = readConfig();
setUserData({
  api_keys: stored_config.api_key,
  main_agent_id: stored_config.main_agent_id,
});

const VALID_COMMANDS = ["/model", "/key", "/session", "/restart", "/exit"];

const CONNECTION_HINT = "Not connected to the backend — press /model or /key to enter an API key.";

type OverlayState =
  | { kind: "model" }
  | { kind: "key_select" }
  | { kind: "key"; model_id: number; switch_after: boolean }
  | { kind: "session" };

function buildSessionEntries(): SessionEntry[] {
  const config = readConfig();
  return Object.entries(config.session ?? {})
    .sort(([, a], [, b]) => (b.last_updated ?? 0) - (a.last_updated ?? 0))
    .map(([session_id, session]) => ({
      id: session_id,
      label: `${new Date(session.last_updated ?? 0).toLocaleString()} — ${
        session.categories?.length ?? 0
      } categories`,
    }));
}

export function App() {
  const { exit } = useApp();
  const layout = useLayout();
  useBracketedPaste();

  const [connected, setConnected] = useState(false);
  const [displays, setDisplays] = useState<DisplayHistoryDTO[]>([]);
  const [categories, setCategories] = useState<TaskCategoryDTO[]>([]);
  const [questions, setQuestions] = useState<StructuredQuestionDTO[] | null>(null);
  const [input_value, setInputValue] = useState("");
  const [command_mode, setCommandMode] = useState(false);
  const [command_index, setCommandIndex] = useState(0);
  const [chat_scroll, setChatScroll] = useState(0);
  const [task_scroll, setTaskScroll] = useState(0);
  const [error_msg, setErrorMsg] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [model_id, setModelId] = useState(getUserData().main_agent_id);
  const questions_ref = useRef<StructuredQuestionDTO[]>([]);

  // ── Socket wiring ─────────────────────────────────────────────────────
  const startSocket = useCallback(() => {
    const socket = connectSocket();
    const callbacks: ListenerCallbacks = {
      onConnectionStatus: (ok) => {
        setConnected(ok);
        if (!ok) {
          setDisplays((prev) =>
            prev.length > 0 &&
            prev[prev.length - 1].role === "system" &&
            prev[prev.length - 1].content === CONNECTION_HINT
              ? prev
              : [...prev, { role: "system", content: CONNECTION_HINT }],
          );
        }
      },
      onMainAgentResponse: (text) => {
        setErrorMsg(null);
        setDisplays((prev) => [...prev, { role: "assistant", content: text }]);
      },
      onTaskUpdate: (payload: TaskUpdatePayload) => setCategories(payload.categories),
      onSubagentResponse: (data) => {
        // Display-only progress — sub-agent reports never reach the main agent.
        const entry: DisplayHistoryDTO = {
          role: "system",
          content: `${data.status === "done" ? "✓" : "✗"} [${data.category}] ${data.report}`,
        };
        saveDisplayHistory(entry);
        setDisplays((prev) => [...prev, entry]);
      },
      onQuestionnaire: (qs) => {
        // A duplicate emit of the same questions must not reset the write-in box.
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
      },
      onAgentError: (message) => {
        setErrorMsg(message);
        emitAgentErrorResponse(message);
      },
    };
    attachHandlers(socket, callbacks);
  }, []);

  const reconnect = useCallback(async () => {
    await waitForWrites();
    setConnected(false);
    startSocket();
  }, [startSocket]);

  useEffect(() => {
    startSocket();

    return () => {
      // Unmounting must also drop the socket so its reconnect timers stop.
      disconnectSocket();
    };
  }, [startSocket]);

  // ── Slash commands ────────────────────────────────────────────────────
  const handleCommand = useCallback(
    async (cmd: string) => {
      switch (cmd) {
        case "/exit":
          await waitForWrites();
          disconnectSocket();
          exit();
          break;
        case "/restart":
          await waitForWrites();
          setDisplays([]);
          setCategories([]);
          setQuestions(null);
          setOverlay(null);
          setErrorMsg(null);
          setChatScroll(0);
          setTaskScroll(0);
          setInputValue("");
          setCommandMode(false);
          setConnected(false);
          startSocket();
          break;
        case "/model":
          setOverlay({ kind: "model" });
          break;
        case "/key":
          setOverlay({ kind: "key_select" });
          break;
        case "/session":
          setOverlay({ kind: "session" });
          break;
        default:
          setDisplays((prev) => [
            ...prev,
            {
              role: "system",
              content: `Unknown command: ${cmd}. Valid: ${VALID_COMMANDS.join(", ")}`,
            },
          ]);
      }
    },
    [exit, startSocket],
  );

  // ── Overlay flows ─────────────────────────────────────────────────────
  const applyModel = useCallback(
    async (next_model_id: number) => {
      setUserData({ main_agent_id: next_model_id });
      setModelId(next_model_id);
      writeUserDataToFile();
      setOverlay(null);
      await reconnect();
    },
    [reconnect],
  );

  const handleModelSelect = (selected_id: number) => {
    const keys = getUserData().api_keys;
    if (!keys[String(selected_id)]) {
      setOverlay({ kind: "key", model_id: selected_id, switch_after: true });
      return;
    }
    void applyModel(selected_id);
  };

  const handleKeyTargetSelect = (selected_id: number) => {
    setOverlay({
      kind: "key",
      model_id: selected_id,
      switch_after: selected_id === getUserData().main_agent_id,
    });
  };

  const handleKeySubmit = async (value: string) => {
    if (!overlay || overlay.kind !== "key") return;
    const keys = getUserData().api_keys;
    setUserData({ api_keys: { ...keys, [String(overlay.model_id)]: value } });
    writeUserDataToFile();
    setOverlay(null);
    if (overlay.switch_after) {
      await applyModel(overlay.model_id);
    }
  };

  const handleSessionSelect = async (session_id: string | null) => {
    // Persist the outgoing session before its in-memory state is replaced.
    await waitForWrites();
    setOverlay(null);
    if (session_id === null) {
      setUserData({
        session_id: crypto.randomUUID(),
        categories: [],
        history: [],
        committed: false,
      });
      setCategories([]);
      setDisplays([]);
      setChatScroll(0);
      await reconnect();
      return;
    }

    const saved = readSessionData(readConfig(), session_id);
    if (!saved) return;
    setUserData({
      session_id,
      categories: saved.categories,
      history: saved.history,
      committed: true,
    });
    setCategories(saved.categories);
    setDisplays(saved.history);
    setChatScroll(0);
    await reconnect();
  };

  const handleQuestionnaireComplete = (answers: QuestionnaireAnswerDTO[]) => {
    setQuestions(null);
    emitQuestionnaireAnswers(answers);
    const summary = answers
      .map((answer) => `Q: ${answer.question}\nA: ${answer.answer}`)
      .join("\n\n");
    const entry: DisplayHistoryDTO = { role: "system", content: summary };
    saveDisplayHistory(entry);
    setDisplays((prev) => [...prev, entry]);
  };

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    commitSession();
    const entry: DisplayHistoryDTO = { role: "user", content: text };
    saveDisplayHistory(entry);
    setDisplays((prev) => [...prev, entry]);
    emitUserPrompt(text);
  };

  // chat_scroll counts wrapped terminal rows up from the newest message: 0 is
  // pinned to the bottom, so new messages appear without touching the state.
  const chat_row_count = chatRows(displays, layout.chat_width).length;
  const max_chat_scroll = Math.max(0, chat_row_count - layout.chat_height);

  // Mouse wheel scrolls whichever pane the pointer is over; mouse sequences are
  // swallowed at the input emitter so overlays never see them.
  useMouseWheel(true, (direction, x) => {
    const over_tasks = x - 1 >= layout.chat_width;
    if (direction === "up") {
      if (over_tasks) setTaskScroll((value) => Math.max(0, value - 1));
      else setChatScroll((value) => Math.min(max_chat_scroll, value + 1));
    } else if (over_tasks) {
      setTaskScroll((value) => value + 1);
    } else {
      setChatScroll((value) => Math.max(0, value - 1));
    }
  });

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setCommandMode(value.startsWith("/"));
    setCommandIndex(0);
  };

  const handlePromptSubmit = (raw: string) => {
    const full = raw.trim();
    if (full) {
      if (full.startsWith("/")) {
        const suggestions = filterCommands(full);
        const is_exact = VALID_COMMANDS.includes(full);
        const index = Math.min(command_index, suggestions.length - 1);
        const chosen =
          !is_exact && index >= 0 && suggestions[index] ? suggestions[index].name : full;
        void handleCommand(chosen);
      } else {
        handleSubmit(full);
      }
    }
    setInputValue("");
    setCommandMode(false);
    setCommandIndex(0);
  };

  // ── Keyboard ──────────────────────────────────────────────────────────
  // Text editing and submission live in PromptBox; this handler owns only the
  // global shortcuts (scrolling, Escape) so the two do not fight over keys.
  useInput((input, key) => {
    // Overlays and the questionnaire own the keyboard while they are open.
    if (overlay || questions) return;

    // Mouse sequences are normally swallowed at the emitter; ignore any that
    // slip through on a non-patched stdin.
    if (isMouseEvent(input)) return;

    // Slash-command suggestions own Up/Down/Tab while command mode is active.
    const suggestions = command_mode ? filterCommands(input_value) : [];
    if (suggestions.length > 0) {
      if (key.upArrow) {
        setCommandIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
        return;
      }
      if (key.downArrow) {
        setCommandIndex((index) => (index >= suggestions.length - 1 ? 0 : index + 1));
        return;
      }
      if (key.tab) {
        const entry = suggestions[Math.min(command_index, suggestions.length - 1)];
        if (entry) setInputValue(entry.name);
        setCommandIndex(0);
        return;
      }
    }

    if (key.escape) {
      setCommandMode(false);
      setInputValue("");
      setCommandIndex(0);
      return;
    }

    // Scrolling (chat_scroll counts lines scrolled up from the bottom)
    if (key.pageUp) {
      setChatScroll((value) => Math.min(max_chat_scroll, value + layout.chat_height));
      return;
    }
    if (key.pageDown) {
      setChatScroll((value) => Math.max(0, value - layout.chat_height));
      return;
    }
    if (key.home) {
      setChatScroll(max_chat_scroll);
      return;
    }
    if (key.end) {
      setChatScroll(0);
      return;
    }
    if (key.upArrow && key.ctrl) {
      setTaskScroll((value) => Math.max(0, value - 1));
      return;
    }
    if (key.downArrow && key.ctrl) {
      setTaskScroll((value) => value + 1);
      return;
    }

    // Up/Down move the prompt cursor when the draft is multi-line; otherwise
    // they scroll the chat.
    const prompt_is_multiline = input_value.includes("\n");
    if (!prompt_is_multiline && key.upArrow) {
      setChatScroll((value) => Math.min(max_chat_scroll, value + 1));
      return;
    }
    if (!prompt_is_multiline && key.downArrow) {
      setChatScroll((value) => Math.max(0, value - 1));
      return;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────
  const session_entries = overlay?.kind === "session" ? buildSessionEntries() : [];

  const bottom_controls = (
    <>
      {/* Questionnaire overlay */}
      {questions && (
        <QuestionnaireBox
          key={JSON.stringify(questions)}
          questions={questions}
          onComplete={handleQuestionnaireComplete}
        />
      )}

      {/* Slash-command overlays */}
      {overlay?.kind === "model" && (
        <ModelPicker
          current_id={model_id}
          api_keys={getUserData().api_keys}
          onSelect={handleModelSelect}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "key_select" && (
        <ModelPicker
          current_id={model_id}
          api_keys={getUserData().api_keys}
          onSelect={handleKeyTargetSelect}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "key" && (
        <KeyPrompt
          model_label={getModelLabel(overlay.model_id)}
          onSubmit={(value) => void handleKeySubmit(value)}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "session" && (
        <SessionPicker
          sessions={session_entries}
          onSelect={(session_id) => void handleSessionSelect(session_id)}
          onCancel={() => setOverlay(null)}
        />
      )}

      {/* Command suggestions */}
      {!overlay && command_mode && (
        <CommandOverlay input={input_value} selected_index={command_index} />
      )}

      {/* Prompt box */}
      {!overlay && (
        <PromptBox
          value={input_value}
          onChange={handleInputChange}
          onSubmit={handlePromptSubmit}
          width={layout.cols - 2}
          border_color={command_mode ? theme.warning : theme.primary}
          placeholder="Type a prompt, / for commands (Esc clears)"
        />
      )}

      {/* Footer */}
      <StatusFooter model_id={model_id} />
    </>
  );

  // Until the backend accepts the connection the prompt and the model/key
  // overlays must stay reachable — otherwise a missing API key is a dead end.
  if (!connected) {
    return (
      <Box flexDirection="column" height={layout.rows - 1}>
        <LogoView />
        {error_msg && (
          <Box paddingX={1}>
            <Text color="red" bold>
              ⚠ {error_msg}
            </Text>
          </Box>
        )}
        {bottom_controls}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={layout.rows - 1}>
      {/* Error banner */}
      {error_msg && (
        <Box>
          <Text color="red" bold>
            ⚠ {error_msg}
          </Text>
        </Box>
      )}

      {/* Main two-pane workspace */}
      <Box flexGrow={1} flexDirection="row">
        {/* Chat pane */}
        <Box flexDirection="column" width={layout.chat_width}>
          <ChatViewport
            displays={displays}
            scroll_offset={chat_scroll}
            height={layout.chat_height}
            width={layout.chat_width}
          />
        </Box>

        {/* Divider */}
        <Box width={1}>
          <Text color="gray">│</Text>
        </Box>

        {/* Tasks pane */}
        <Box flexDirection="column" flexGrow={1}>
          <Text bold color="cyan">
            Tasks
          </Text>
          <TaskPane
            categories={categories}
            scroll_offset={task_scroll}
            height={layout.chat_height - 1}
            width={layout.task_width}
          />
        </Box>
      </Box>

      {bottom_controls}
    </Box>
  );
}
