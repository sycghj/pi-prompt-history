import assert from "node:assert/strict";
import test from "node:test";

import {
  type PromptHistorySelection,
  PromptHistorySelector,
} from "../src/selector-ui";

type TestResult = {
  id: string;
  sessionFile: string;
  sessionName: string;
  preview: string;
  text: string;
  cwd: string;
  timestampMs: number;
  score: number;
  matchPositions: number[];
};

function createResults(): TestResult[] {
  return [
    {
      id: "first",
      sessionFile: "/tmp/sessions/first.jsonl",
      sessionName: "First Session",
      preview: "first prompt",
      text: "first prompt",
      cwd: "/tmp/project-a",
      timestampMs: 100,
      score: 10,
      matchPositions: [],
    },
    {
      id: "second",
      sessionFile: "/tmp/sessions/second.jsonl",
      sessionName: "Second Session",
      preview: "second prompt",
      text: "second prompt",
      cwd: "/tmp/project-a",
      timestampMs: 200,
      score: 9,
      matchPositions: [],
    },
  ];
}

function createTheme(): {
  fg: (_name: string, text: string) => string;
  bold: (text: string) => string;
} {
  return {
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function createActionProbe(options: { initialQuery?: string } = {}): {
  selector: PromptHistorySelector;
  get selectedAction(): PromptHistorySelection["action"] | undefined;
} {
  let selectedAction: PromptHistorySelection["action"] | undefined;
  const selector = new PromptHistorySelector({
    tui: { requestRender() {} } as never,
    theme: createTheme(),
    initialScope: "local",
    initialResults: createResults() as never,
    primaryAction: "copy",
    currentCwd: "/tmp/project-a",
    initialQuery: options.initialQuery,
    onSearch: async () => [],
    onSelect: (selection: PromptHistorySelection) => {
      selectedAction = selection.action;
    },
    onCancel: () => {},
  } as never);

  return {
    selector,
    get selectedAction() {
      return selectedAction;
    },
  };
}

test("PromptHistorySelector uses injected keybindings for navigation", () => {
  const selector = new PromptHistorySelector({
    tui: { requestRender() {} } as never,
    theme: createTheme(),
    initialScope: "local",
    initialResults: createResults() as never,
    primaryAction: "copy",
    currentCwd: "/tmp/project-a",
    onSearch: async () => [],
    onSelect: () => {},
    onCancel: () => {},
    keybindings: {
      matches(data: string, keybinding: string) {
        return data === "__down__" && keybinding === "tui.select.down";
      },
    },
  } as never);

  selector.handleInput("__down__");

  const rendered = selector.render(80).join("\n");
  assert.match(rendered, /\n│› second prompt/);
});

test("PromptHistorySelector accepts legacy keybinding ids from injected managers", () => {
  const selector = new PromptHistorySelector({
    tui: { requestRender() {} } as never,
    theme: createTheme(),
    initialScope: "local",
    initialResults: createResults() as never,
    primaryAction: "copy",
    currentCwd: "/tmp/project-a",
    onSearch: async () => [],
    onSelect: () => {},
    onCancel: () => {},
    keybindings: {
      matches(data: string, keybinding: string) {
        return data === "__down__" && keybinding === "selectDown";
      },
    },
  } as never);

  selector.handleInput("__down__");

  const rendered = selector.render(80).join("\n");
  assert.match(rendered, /\n│› second prompt/);
});

test("PromptHistorySelector treats F2 CSI variants as resume action", () => {
  for (const sequence of ["\x1b[Q", "\x1b[1;1Q", "\x1b[12;1~"]) {
    const probe = createActionProbe();

    probe.selector.handleInput(sequence);

    assert.equal(probe.selectedAction, "resume", JSON.stringify(sequence));
  }
});

test("PromptHistorySelector lets typed resume intent make Enter resume", () => {
  const probe = createActionProbe({ initialQuery: "resume: super_admin" });

  probe.selector.handleInput("\r");

  assert.equal(probe.selectedAction, "resume");
});
