import { render } from "preact";
import { App } from "./app";
import "./styles.css";
import { initWasmCore } from "./wasmBridge";

void initWasmCore();

render(<App />, document.getElementById("app")!);
