export type MemorizeTestSettings = {
  enterToSubmit: boolean;
  skipKnownCard: boolean;
  selfCheckOnly: boolean;
  reverseCard: boolean;
  shuffleCards: boolean;
  disableShortcuts: boolean;
  readAloud: boolean;
  cardStyleEnabled: boolean;
  textColor: "normal" | "blue" | "red";
  textWeight: "normal" | "bold";
  textSize: "auto" | "normal" | "large";
  hintVisibility: "show" | "hide";
  turnStyle: "normal" | "quick";
};

export const DEFAULT_MEMORIZE_TEST_SETTINGS: MemorizeTestSettings = {
  enterToSubmit: true,
  skipKnownCard: false,
  selfCheckOnly: false,
  reverseCard: false,
  shuffleCards: false,
  disableShortcuts: false,
  readAloud: false,
  cardStyleEnabled: true,
  textColor: "normal",
  textWeight: "normal",
  textSize: "auto",
  hintVisibility: "show",
  turnStyle: "normal",
};

const SETTINGS_PREFIX = "memorize-test-settings:";

export function loadMemorizeTestSettings(deckId: string): MemorizeTestSettings {
  if (typeof window === "undefined") return DEFAULT_MEMORIZE_TEST_SETTINGS;
  try {
    const raw = window.localStorage.getItem(`${SETTINGS_PREFIX}${deckId}`);
    if (!raw) return DEFAULT_MEMORIZE_TEST_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MemorizeTestSettings>;
    return { ...DEFAULT_MEMORIZE_TEST_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_MEMORIZE_TEST_SETTINGS;
  }
}

export function saveMemorizeTestSettings(deckId: string, settings: MemorizeTestSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${SETTINGS_PREFIX}${deckId}`, JSON.stringify(settings));
}
