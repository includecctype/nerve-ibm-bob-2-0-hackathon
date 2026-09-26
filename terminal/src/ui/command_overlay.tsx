import { PasswordInput, Select } from "@inkjs/ui";
import type { CommandMode } from "../command/command_mode";
import { CommandPickerBox, CommandPickerOverlay } from "../command/command_picker_box";
import { buildModelSelectOptions } from "../command/model_options";

type CommandOverlayProps = {
  commandMode: CommandMode;
  screenWidth: number;
  screenHeight: number;
  onModelSelect: (value: string) => void;
  onKeyModelSelect: (value: string) => void;
  onSessionSelect: (value: string) => void;
  onApiKeySubmit: (value: string) => void;
};

export function CommandOverlay({
  commandMode,
  screenWidth,
  screenHeight,
  onModelSelect,
  onKeyModelSelect,
  onSessionSelect,
  onApiKeySubmit,
}: CommandOverlayProps) {
  if (commandMode.type === "select_model") {
    return (
      <CommandPickerOverlay screenWidth={screenWidth} screenHeight={screenHeight}>
        <CommandPickerBox title="Select a model:" width={screenWidth}>
          <Select
            options={buildModelSelectOptions().map((o) => ({
              label: o.label,
              value: o.value,
            }))}
            onChange={onModelSelect}
          />
        </CommandPickerBox>
      </CommandPickerOverlay>
    );
  }

  if (commandMode.type === "select_key_model") {
    return (
      <CommandPickerOverlay screenWidth={screenWidth} screenHeight={screenHeight}>
        <CommandPickerBox title="Select a model to update its API key:" width={screenWidth}>
          <Select
            options={buildModelSelectOptions().map((o) => ({
              label: o.label,
              value: o.value,
            }))}
            onChange={onKeyModelSelect}
          />
        </CommandPickerBox>
      </CommandPickerOverlay>
    );
  }

  if (commandMode.type === "select_session") {
    return (
      <CommandPickerOverlay screenWidth={screenWidth} screenHeight={screenHeight}>
        <CommandPickerBox title="Select a session:" width={screenWidth}>
          <Select
            options={commandMode.sessions.map((s) => ({
              label: s.label,
              value: s.value,
            }))}
            onChange={onSessionSelect}
          />
        </CommandPickerBox>
      </CommandPickerOverlay>
    );
  }

  if (commandMode.type === "enter_api_key") {
    return (
      <CommandPickerOverlay screenWidth={screenWidth} screenHeight={screenHeight}>
        <CommandPickerBox
          title={
            commandMode.flow === "key"
              ? `Enter new API key for ${commandMode.modelLabel}:`
              : `Enter API key for ${commandMode.modelLabel} (id=${commandMode.modelId}):`
          }
          width={screenWidth}
        >
          <PasswordInput placeholder="API key..." onSubmit={onApiKeySubmit} />
        </CommandPickerBox>
      </CommandPickerOverlay>
    );
  }

  return null;
}
