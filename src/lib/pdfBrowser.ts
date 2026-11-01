import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type PdfChromiumModule = {
  args: string[];
  defaultViewport: { width: number; height: number } | null;
  headless: boolean | "shell";
  setGraphicsMode?: (mode: boolean) => void;
  executablePath: () => Promise<string>;
};

export type PdfBrowserLaunchConfig = {
  executablePath: string;
  args: string[];
  defaultViewport: { width: number; height: number } | null;
  headless: boolean | "shell";
  /** True when using @sparticuz/chromium (Vercel/serverless). */
  useServerlessChromium: boolean;
};

/**
 * Whether PDF generation should use the serverless Chromium binary.
 * Local Windows/macOS cannot run the Lambda Chromium package.
 */
export function shouldUseServerlessChromium(): boolean {
  return Boolean(process.env.VERCEL) || process.env.PDF_USE_SPARTICUZ === "1";
}

/**
 * Candidate paths for a locally installed Chrome/Edge/Chromium.
 */
function localBrowserCandidates(): string[] {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const candidates: string[] = envPath ? [envPath] : [];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 =
      process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    candidates.push(
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    );
  }

  return candidates;
}

/**
 * Returns the first existing local browser executable, if any.
 */
export function findLocalBrowserExecutable(): string | null {
  for (const candidate of localBrowserCandidates()) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve Puppeteer launch options for bracket PDF generation.
 * Vercel uses @sparticuz/chromium; local uses installed Chrome/Edge.
 */
export async function resolvePdfBrowserLaunch(
  chromium: PdfChromiumModule,
): Promise<PdfBrowserLaunchConfig> {
  if (shouldUseServerlessChromium()) {
    const executablePath = await chromium.executablePath();
    return {
      executablePath,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
      useServerlessChromium: true,
    };
  }

  const localPath = findLocalBrowserExecutable();
  if (!localPath) {
    throw new Error(
      "PDF generation needs Chrome or Edge installed locally, or set PUPPETEER_EXECUTABLE_PATH. " +
        "@sparticuz/chromium only runs on Vercel/Linux serverless.",
    );
  }

  return {
    executablePath: localPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
    defaultViewport: chromium.defaultViewport,
    headless: true,
    useServerlessChromium: false,
  };
}
