/** Render the same ATS component and print rules used by the admin builder. */
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const temp = await mkdtemp(join(tmpdir(), "portfolio-resume-"));
let browser;
try {
  const bundle = join(temp, "resume.cjs");
  await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ATSTemplate } from './src/pages/resume/ATSTemplate';
    import { FRAME_CSS } from './src/pages/resume/print';
    import { publicResumeContent } from './src/lib/public-resume';
    export const markup = renderToStaticMarkup(<ATSTemplate content={publicResumeContent} />);
    export const css = FRAME_CSS;
  `, resolveDir: process.cwd(), loader: "tsx" }, outfile: bundle, bundle: true,
    platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent" });
  const { markup, css } = await import(pathToFileURL(bundle).href);
  const spacer = '<tr><td><div class="resume-page-spacer" aria-hidden="true"></div></td></tr>';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>James Vincent Calunsag — Resume</title>
    <style>*{box-sizing:border-box}body{margin:0}.resume-sheet{width:100%;min-height:0}${css}</style>
    <table class="resume-print-frame" role="presentation"><thead>${spacer}</thead><tbody><tr><td>${markup}</td></tr></tbody><tfoot>${spacer}</tfoot></table></html>`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  await writeFile(resolve("public/james-vincent-calunsag-resume.pdf"), pdf);
  console.log(`[resume] shared ATS template: ${pdf.length} bytes`);
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}
