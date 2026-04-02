export type MemorizeViewerSettings = {
  tapToFlip: boolean;
  keyboardEnabled: boolean;
  showCheckIndicator: boolean;
  randomOrder: boolean;
  infiniteLoop: boolean;
  swipeEnabled: boolean;
  textColor: string;
};

export const DEFAULT_MEMORIZE_VIEWER_SETTINGS: MemorizeViewerSettings = {
  tapToFlip: true,
  keyboardEnabled: false,
  showCheckIndicator: true,
  randomOrder: false,
  infiniteLoop: false,
  swipeEnabled: true,
  textColor: "blue",
};

const SETTINGS_KEY_PREFIX = "memorize-viewer-settings:";

export function loadMemorizeViewerSettings(deckId: string): MemorizeViewerSettings {
  if (typeof window === "undefined") {
    return DEFAULT_MEMORIZE_VIEWER_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${deckId}`);
    if (!raw) {
      return DEFAULT_MEMORIZE_VIEWER_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<MemorizeViewerSettings>;
    return {
      ...DEFAULT_MEMORIZE_VIEWER_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_MEMORIZE_VIEWER_SETTINGS;
  }
}

export function saveMemorizeViewerSettings(deckId: string, settings: MemorizeViewerSettings) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(`${SETTINGS_KEY_PREFIX}${deckId}`, JSON.stringify(settings));
}
