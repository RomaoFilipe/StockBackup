type BrowserLike = {
  newPage: () => Promise<{
    setContent: (html: string, options?: any) => Promise<void>;
    emulateMediaType?: (type: "screen" | "print") => Promise<void>;
    pdf: (options: any) => Promise<Uint8Array | Buffer>;
    close: () => Promise<void>;
  }>;
  close: () => Promise<void>;
};

async function dynamicImport(moduleName: string): Promise<any> {
  const loader = new Function("m", "return import(m);") as (m: string) => Promise<any>;
  return loader(moduleName);
}

async function loadPuppeteerModule() {
  try {
    const mod = await dynamicImport("puppeteer");
    return mod.default ?? mod;
  } catch {
    const mod = await dynamicImport("puppeteer-core");
    return mod.default ?? mod;
  }
}

export async function launchPdfBrowser(): Promise<BrowserLike> {
  const puppeteer = await loadPuppeteerModule();

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROMIUM_PATH ||
    process.env.GOOGLE_CHROME_BIN ||
    undefined;

  const launchOptions: any = {
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return puppeteer.launch(launchOptions) as Promise<BrowserLike>;
}
