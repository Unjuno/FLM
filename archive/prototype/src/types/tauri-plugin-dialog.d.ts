declare module '@tauri-apps/plugin-dialog' {
  interface Filter {
    name: string;
    extensions: string[];
  }

  interface OpenDialogOptions {
    title?: string;
    defaultPath?: string;
    multiple?: boolean;
    directory?: boolean;
    filters?: Filter[];
  }

  export function open(
    options?: OpenDialogOptions
  ): Promise<string | string[] | null>;
}
