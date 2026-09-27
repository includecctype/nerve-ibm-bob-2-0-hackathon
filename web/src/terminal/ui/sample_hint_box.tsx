import { Text } from "ink";
import { CommandPickerBox, CommandPickerOverlay } from "../command/command_picker_box";

export const SAMPLE_HINT_MS = 12000;

const TIPS = [
  "Task graph morph — nodes appear, statuses pulse, removed work fades out",
  "Pan the graph — drag inside the Tasks pane (or Ctrl+↑/↓ / mouse wheel)",
  "Incremental re-planning — type a prompt mid-run; running work is never interrupted",
];

type SampleHintBoxProps = {
  screenWidth: number;
  screenHeight: number;
};

export function SampleHintBox({ screenWidth, screenHeight }: SampleHintBoxProps) {
  return (
    <CommandPickerOverlay screenWidth={screenWidth} screenHeight={screenHeight}>
      <CommandPickerBox title="While the demo runs — watch for:" width={screenWidth}>
        {TIPS.map((tip) => (
          <Text key={tip} dimColor>
            {`• ${tip}`}
          </Text>
        ))}
      </CommandPickerBox>
    </CommandPickerOverlay>
  );
}
