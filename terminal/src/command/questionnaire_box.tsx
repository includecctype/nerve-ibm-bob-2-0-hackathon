import { Select } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import React from "react";
import type { QuestionnaireAnswerDTO, StructuredQuestionDTO } from "../dto/wire.js";
import { theme } from "../ui/theme.js";

const OTHER_PATTERN = /other|custom|none of the above|something else/i;

export function isOtherLikeOption(option: string): boolean {
  return OTHER_PATTERN.test(option);
}

export function buildQuestionOptions(options: string[]): Array<{ label: string; value: string }> {
  const items = options
    .filter((option) => !isOtherLikeOption(option))
    .map((option) => ({ label: option, value: option }));
  items.push({ label: "Other (write-in)", value: "__other__" });
  return items;
}

interface QuestionnaireBoxProps {
  questions: StructuredQuestionDTO[];
  onComplete: (answers: QuestionnaireAnswerDTO[]) => void;
  onCancel: () => void;
}

export function QuestionnaireBox({ questions, onComplete, onCancel }: QuestionnaireBoxProps) {
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<QuestionnaireAnswerDTO[]>([]);
  const [write_in, setWriteIn] = React.useState("");
  const [in_write_in, setInWriteIn] = React.useState(false);

  const current = questions[index];

  // Owns every key while a questionnaire is on screen: Esc cancels the
  // question, and the write-in box collects free text.
  useInput((input, key) => {
    const active = questions[index];
    if (!active) return;

    if (!in_write_in) {
      if (key.escape) onCancel();
      return;
    }

    if (key.escape) {
      setInWriteIn(false);
      setWriteIn("");
      return;
    }

    if (key.return) {
      const value = write_in.trim();
      setInWriteIn(false);
      setWriteIn("");
      if (!value) return;
      const new_answers = [...answers, { question: active.question, answer: value }];
      setAnswers(new_answers);
      if (index + 1 >= questions.length) {
        onComplete(new_answers);
      } else {
        setIndex(index + 1);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setWriteIn((value) => value.slice(0, -1));
      return;
    }

    // Strip control characters and escape sequences; the emitter patch already
    // removed bracketed-paste markers and normalised CR away.
    const chunk = [...input]
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join("");
    if (!key.ctrl && !key.meta && chunk) {
      setWriteIn((value) => value + chunk);
    }
  });

  if (!current) return null;

  const handleSelect = (value: string) => {
    if (value === "__other__") {
      setInWriteIn(true);
      return;
    }
    const new_answers = [...answers, { question: current.question, answer: value }];
    setAnswers(new_answers);
    if (index + 1 >= questions.length) {
      onComplete(new_answers);
    } else {
      setIndex(index + 1);
    }
  };

  if (in_write_in) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1}>
        <Text color={theme.warning}>{current.question}</Text>
        <Text color={theme.muted}>Type your answer (Enter to confirm, Esc to cancel):</Text>
        <Text>
          {write_in}
          <Text color={theme.primary}>▊</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={1}>
      <Text color={theme.primary} bold>
        Question {index + 1}/{questions.length}
      </Text>
      <Text>{current.question}</Text>
      <Select options={buildQuestionOptions(current.options)} onChange={handleSelect} />
      <Text color={theme.muted}>Enter to answer · Esc to skip</Text>
    </Box>
  );
}
