import { useEffect, useState } from "react";

type Props = {
  value: string;
  onCommit: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  type?: string;
};

/** Local typing buffer; commits to parent on blur (or Enter). */
export function DeferredInput({
  value,
  onCommit,
  readOnly,
  className,
  type = "text",
}: Props) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <input
      type={type}
      className={className}
      readOnly={readOnly}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
