type LoadingPaneProps = {
  label?: string;
  variant?: "page" | "fill" | "overlay" | "screen";
};

export function LoadingPane({ label = "加载中", variant = "page" }: LoadingPaneProps) {
  const className =
    variant === "page"
      ? "page loading-page"
      : variant === "fill"
        ? "loading-fill"
        : variant === "screen"
          ? "loading-overlay loading-overlay-screen"
          : "loading-overlay";

  return (
    <div className={className} role="status" aria-live="polite">
      {variant !== "page" && <span className="loading-spinner" aria-hidden />}
      <span className="loading-label">{label}</span>
    </div>
  );
}
