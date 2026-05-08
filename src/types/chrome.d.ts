declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }

    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>;
    function create(createProperties: { url: string }): Promise<Tab>;
  }

  namespace scripting {
    interface InjectionResult<T> {
      result?: T;
    }

    function executeScript<T>(injection: {
      target: { tabId: number };
      func: () => T;
    }): Promise<InjectionResult<T>[]>;

    function executeScript(injection: {
      target: { tabId: number };
      files: string[];
    }): Promise<InjectionResult<unknown>[]>;
  }

  namespace storage {
    namespace local {
      function get(keys: string): Promise<Record<string, unknown>>;
      function set(items: Record<string, unknown>): Promise<void>;
    }
  }

  namespace runtime {
    function getURL(path: string): string;
  }

  namespace action {
    const onClicked: {
      addListener(callback: (tab: tabs.Tab) => void | Promise<void>): void;
    };
  }
}

interface Window {
  __ghHtmlPreviewLocalLoaded?: boolean;
}
