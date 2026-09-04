import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers, type Panel } from "@codemirror/view";

type QueryFields = {
  search: HTMLInputElement;
  replace: HTMLInputElement;
  caseSensitive: HTMLInputElement;
  regexp: HTMLInputElement;
  wholeWord: HTMLInputElement;
};

/** 避免超大文档全量扫描；超过后显示 N+ */
const MATCH_COUNT_LIMIT = 9999;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> | null,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "className") node.className = String(value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (value === true) node.setAttribute(key, "");
      else if (value !== false && value != null) node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function btn(
  label: string,
  onClick: () => void,
  className = "wisdom-search-btn"
): HTMLButtonElement {
  return el(
    "button",
    {
      type: "button",
      className,
      onClick: (e: Event) => {
        e.preventDefault();
        onClick();
      },
    },
    label
  );
}

function option(input: HTMLInputElement, label: string): HTMLLabelElement {
  return el("label", { className: "wisdom-search-opt" }, input, label);
}

function buildFields(query: SearchQuery): QueryFields {
  const search = el("input", {
    type: "text",
    className: "cm-textfield",
    name: "search",
    placeholder: "查找内容",
    "aria-label": "查找",
    "main-field": "true",
    value: query.search,
    autocomplete: "off",
    spellcheck: "false",
  });

  const replace = el("input", {
    type: "text",
    className: "cm-textfield",
    name: "replace",
    placeholder: "替换为",
    "aria-label": "替换",
    value: query.replace,
    autocomplete: "off",
    spellcheck: "false",
  });

  const caseSensitive = el("input", {
    type: "checkbox",
    name: "case",
    ...(query.caseSensitive ? { checked: true } : {}),
  });
  const regexp = el("input", {
    type: "checkbox",
    name: "re",
    ...(query.regexp ? { checked: true } : {}),
  });
  const wholeWord = el("input", {
    type: "checkbox",
    name: "word",
    ...(query.wholeWord ? { checked: true } : {}),
  });

  return { search, replace, caseSensitive, regexp, wholeWord };
}

function countMatches(
  state: EditorState,
  query: SearchQuery
): { current: number; total: number; capped: boolean } {
  if (!query.valid || !query.search) {
    return { current: 0, total: 0, capped: false };
  }

  const cursor = query.getCursor(state);
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  let item = cursor.next();

  while (!item.done) {
    total++;
    if (item.value.from === from && item.value.to === to) {
      current = total;
    }
    if (total >= MATCH_COUNT_LIMIT) {
      const more = cursor.next();
      return { current, total, capped: !more.done };
    }
    item = cursor.next();
  }

  return { current, total, capped: false };
}

function formatMatchCount(info: {
  current: number;
  total: number;
  capped: boolean;
}): string {
  if (info.total === 0) return "0 处";
  const totalLabel = info.capped ? `${info.total}+` : String(info.total);
  if (info.current > 0) return `${info.current} / ${totalLabel}`;
  return `共 ${totalLabel} 处`;
}

/**
 * 自定义查找/替换面板：中文文案 + 双行对齐布局 + 匹配计数。
 * 满足 CodeMirror search createPanel 约定（含 main-field）。
 */
export function createZhSearchPanel(view: EditorView): Panel {
  const query = getSearchQuery(view.state);
  const fields = buildFields(query);
  let current = query;

  const matchCount = el("span", {
    className: "wisdom-search-count",
    "aria-live": "polite",
  });

  const refreshCount = (state = view.state) => {
    const q = getSearchQuery(state);
    if (!q.search) {
      matchCount.textContent = "";
      matchCount.title = "";
      return;
    }
    if (!q.valid) {
      matchCount.textContent = "无效";
      matchCount.title = "正则表达式无效";
      return;
    }
    const info = countMatches(state, q);
    matchCount.textContent = formatMatchCount(info);
    matchCount.title = info.capped
      ? `匹配数超过 ${MATCH_COUNT_LIMIT}，已截断显示`
      : info.total === 0
        ? "无匹配"
        : info.current > 0
          ? `第 ${info.current} 处，共 ${info.total} 处`
          : `共 ${info.total} 处匹配`;
  };

  const commit = () => {
    const next = new SearchQuery({
      search: fields.search.value,
      replace: fields.replace.value,
      caseSensitive: fields.caseSensitive.checked,
      regexp: fields.regexp.checked,
      wholeWord: fields.wholeWord.checked,
    });
    if (!next.eq(current)) {
      current = next;
      view.dispatch({ effects: setSearchQuery.of(next) });
    }
    refreshCount();
  };

  for (const input of [fields.search, fields.replace]) {
    input.addEventListener("change", commit);
    input.addEventListener("keyup", commit);
  }
  for (const input of [fields.caseSensitive, fields.regexp, fields.wholeWord]) {
    input.addEventListener("change", commit);
  }

  const findRow = el(
    "div",
    { className: "wisdom-search-row" },
    el("div", { className: "wisdom-search-field" }, fields.search),
    el(
      "div",
      { className: "wisdom-search-actions" },
      btn("下一个", () => findNext(view)),
      btn("上一个", () => findPrevious(view)),
      btn("全选", () => selectMatches(view)),
      matchCount
    ),
    el(
      "div",
      { className: "wisdom-search-opts" },
      option(fields.caseSensitive, "区分大小写"),
      option(fields.regexp, "正则"),
      option(fields.wholeWord, "全词匹配")
    )
  );

  const rows: HTMLElement[] = [findRow];
  if (!view.state.readOnly) {
    rows.push(
      el(
        "div",
        { className: "wisdom-search-row" },
        el("div", { className: "wisdom-search-field" }, fields.replace),
        el(
          "div",
          { className: "wisdom-search-actions" },
          btn("替换", () => replaceNext(view)),
          btn("全部替换", () => replaceAll(view), "wisdom-search-btn primary")
        ),
        el("div", { className: "wisdom-search-opts wisdom-search-opts-spacer" })
      )
    );
  }

  const close = el(
    "button",
    {
      type: "button",
      className: "wisdom-search-close",
      "aria-label": "关闭",
      onClick: () => closeSearchPanel(view),
    },
    "×"
  );

  const dom = el(
    "div",
    {
      className: "cm-search wisdom-search",
      onKeyDown: (e: KeyboardEvent) => {
        if (runScopeHandlers(view, e, "search-panel")) {
          e.preventDefault();
          return;
        }
        if (e.key === "Enter" && e.target === fields.search) {
          e.preventDefault();
          (e.shiftKey ? findPrevious : findNext)(view);
        } else if (e.key === "Enter" && e.target === fields.replace) {
          e.preventDefault();
          replaceNext(view);
        }
      },
    },
    el("div", { className: "wisdom-search-main" }, ...rows),
    close
  );

  return {
    dom,
    top: true,
    mount() {
      fields.search.select();
      refreshCount();
    },
    update(update) {
      let queryChanged = false;
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(setSearchQuery) && !effect.value.eq(current)) {
            current = effect.value;
            fields.search.value = current.search;
            fields.replace.value = current.replace;
            fields.caseSensitive.checked = current.caseSensitive;
            fields.regexp.checked = current.regexp;
            fields.wholeWord.checked = current.wholeWord;
            queryChanged = true;
          }
        }
      }
      if (queryChanged || update.docChanged || update.selectionSet) {
        refreshCount(update.state);
      }
    },
  };
}
