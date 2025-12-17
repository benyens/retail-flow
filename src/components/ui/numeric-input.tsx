import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean; // por si algún día quieres decimales
};

function cleanNumeric(raw: string, allowDecimal: boolean) {
  let v = raw.replace(/[^\d.]/g, "");
  if (!allowDecimal) v = v.replace(/\./g, "");
  const i = v.indexOf(".");
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
  return v;
}

export const NumericInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, allowDecimal = false, className, ...rest }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        pattern={allowDecimal ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
        value={value}
        onChange={(e) => onChange(cleanNumeric(e.target.value, allowDecimal))}
        onKeyDown={(e) => {
          // bloquear letras típicas en number: e/E/+/- y cualquier letra
          if (
            e.key.length === 1 &&
            !/[0-9]/.test(e.key) &&
            !(allowDecimal && e.key === ".")
          ) {
            e.preventDefault();
          }
          // deja backspace, delete, arrows, tab, enter, etc.
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text");
          onChange(cleanNumeric(text, allowDecimal));
        }}
        className={cn(className)}
        {...rest}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";
