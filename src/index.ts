export {
  ejsLanguage, ejs,
  ejsCompletionSource, ejsJavaScriptCompletionSource,
  ejsLocalsCompletionSource, ejsScriptBindingsCompletionSource,
  localsToScope, inEjsJavaScript,
  collectEjsScriptBindings, mergeLocalsWithBindings, inferCallbackBindingShapes,
  ejsLint, ejsLintSource, ejsDiagnostics
} from "./ejs"