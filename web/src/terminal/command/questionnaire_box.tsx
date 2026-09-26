import { Select } from "@inkjs/ui";
import { Box, Text } from "ink";
import type { StructuredQuestionDTO } from "../dto/wire";
import { BG_PANEL } from "../ui/theme";

const OTHER_OPTION_VALUE = "__other__";
const OTHER_OPTION_LABEL = "other";

// Model-supplied options that mean "let me type my own answer" are routed to the
// write-in box instead of being answered literally, and never shown twice.
const OTHER_LIKE_PATTERN =
  /^(other|others|other option|none of the above|none of these|something else|custom|my own answer)$/i;

export function isOtherLikeOption(value: string): boolean {
  return OTHER_LIKE_PATTERN.test(value.trim());
}

export function buildQuestionOptions(raw_options: string[]): { label: string; value: string }[] {
  const cleaned = raw_options
    .map((opt) => opt.trim())
    .filter((opt) => opt.length > 0 && !isOtherLikeOption(opt));
  return [
    ...cleaned.map((label) => ({ label, value: label })),
    { label: OTHER_OPTION_LABEL, value: OTHER_OPTION_VALUE },
  ];
}

type QuestionnaireBoxProps = {
  question: StructuredQuestionDTO;
  current: number;
  total: number;
  onSelect: (value: string) => void;
  freeText: boolean;
  onOther: () => void;
};

export function QuestionnaireBox({
  question,
  current,
  total,
  onSelect,
  freeText,
  onOther,
}: QuestionnaireBoxProps) {
  const options = buildQuestionOptions(question.options);

  const handleChange = (value: string) => {
    if (value === OTHER_OPTION_VALUE || isOtherLikeOption(value)) {
      onOther();
      return;
    }
    onSelect(value);
  };

  return (
    <Box
      width="100%"
      flexDirection="column"
      display="flex"
      backgroundColor={BG_PANEL}
      paddingX={1}
      paddingY={1}
      flexShrink={0}
    >
      <Text bold>
        Question {current + 1}/{total}: {question.question}
      </Text>
      {!freeText && (
        <Select options={options} visibleOptionCount={options.length} onChange={handleChange} />
      )}
    </Box>
  );
}
