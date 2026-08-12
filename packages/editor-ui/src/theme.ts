/** Sync body theme class for desktop / non-VS Code hosts. VS Code already sets vscode-light/dark. */
export function syncHostThemeClass(): () => void {
  const body = document.body;
  const hasVsCodeClass =
    body.classList.contains("vscode-light") ||
    body.classList.contains("vscode-dark") ||
    body.classList.contains("vscode-high-contrast") ||
    body.classList.contains("vscode-high-contrast-light");

  if (hasVsCodeClass) {
    return () => undefined;
  }

  const apply = () => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    body.classList.toggle("theme-dark", dark);
    body.classList.toggle("theme-light", !dark);
  };

  apply();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => apply();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function isDarkTheme(): boolean {
  const body = document.body;
  if (
    body.classList.contains("vscode-light") ||
    body.classList.contains("vscode-high-contrast-light") ||
    body.classList.contains("theme-light")
  ) {
    return false;
  }
  if (
    body.classList.contains("vscode-dark") ||
    body.classList.contains("vscode-high-contrast") ||
    body.classList.contains("theme-dark")
  ) {
    return true;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

/** Watch VS Code / system theme class flips and re-run callback. */
export function observeHostTheme(onChange: () => void): () => void {
  const body = document.body;
  let lastDark = isDarkTheme();

  const maybeNotify = () => {
    const dark = isDarkTheme();
    if (dark !== lastDark) {
      lastDark = dark;
      onChange();
    }
  };

  const mo = new MutationObserver(maybeNotify);
  mo.observe(body, { attributes: true, attributeFilter: ["class"] });

  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onMq = () => maybeNotify();
  mq?.addEventListener("change", onMq);

  return () => {
    mo.disconnect();
    mq?.removeEventListener("change", onMq);
  };
}
