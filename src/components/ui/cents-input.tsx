import { TextInput, type TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChangeText" | "keyboardType"> & {
  cents: number;
  onChangeCents: (cents: number) => void;
};

/**
 * Banking-style amount entry (like the BofA app): digits fill in from the right
 * as cents. Typing "266" → $2.66; "26600" → $266.00; backspace shifts back.
 * The number-pad keyboard only emits digits + backspace, so stripping
 * non-digits and reparsing the whole string as cents is reliable regardless of
 * cursor position. Renders the bare number ("2.66") — pair it with a separate
 * "$" label.
 */
export function CentsInput({ cents, onChangeCents, ...rest }: Props) {
  return (
    <TextInput
      {...rest}
      value={cents === 0 ? "" : (cents / 100).toFixed(2)}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, "").slice(0, 9); // cap to keep it sane
        onChangeCents(digits ? parseInt(digits, 10) : 0);
      }}
      keyboardType="number-pad"
    />
  );
}
