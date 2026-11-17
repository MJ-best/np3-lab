// Keep the iOS version in step with package.json, the way Android reads it
// (android/app/build.gradle): "0.7.0" → version 0.7.0, base build 700.
// If the Xcode project already has build >= base, increment it so App Store Connect re-uploads succeed.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const baseBuild = version.split(".").reduce((n, part) => n * 100 + Number(part), 0);
const file = "ios/App/App.xcodeproj/project.pbxproj";
const text = readFileSync(file, "utf8");
const curMatch = /CURRENT_PROJECT_VERSION = (\d+);/.exec(text);
const curBuild = curMatch ? Number(curMatch[1]) : 0;
const build = curBuild >= baseBuild ? curBuild + 1 : baseBuild;

writeFileSync(
  file,
  text
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`),
);
console.log(`iOS version ${version} (${build})`);
