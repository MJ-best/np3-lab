// Keep the iOS version in step with package.json, the way Android reads it
// (android/app/build.gradle): "0.6.7" → version 0.6.7, build 607. Runs from `npm version`.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const build = version.split(".").reduce((n, part) => n * 100 + Number(part), 0);
const file = "ios/App/App.xcodeproj/project.pbxproj";
writeFileSync(
  file,
  readFileSync(file, "utf8")
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`),
);
console.log(`iOS version ${version} (${build})`);
