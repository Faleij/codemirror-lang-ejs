import {EditorView} from "@codemirror/view"
import {EditorState, Extension} from "@codemirror/state"
import {syntaxTree} from "@codemirror/language"
import {Diagnostic, linter, lintGutter} from "@codemirror/lint"
import {
  collectEjsScriptBindings, inferCallbackBindingShapes, localsToScope
} from "./scope"

const jsBuiltins = new Set([
  "console", "JSON", "Math", "Array", "Object", "String", "Number", "Boolean",
  "Date", "Error", "RegExp", "Promise", "Map", "Set", "WeakMap", "WeakSet",
  "Symbol", "Proxy", "Reflect", "Intl", "parseInt", "parseFloat", "isNaN",
  "isFinite", "encodeURI", "decodeURI", "encodeURIComponent", "decodeURIComponent",
  "undefined", "null", "true", "false", "NaN", "Infinity", "this", "arguments",
  "require", "module", "exports", "global", "globalThis", "window", "document",
  "include"
])

const jsKeywords = new Set(
  "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch throw try typeof var void while with yield await async of".split(" ")
)

function collectKnownNames(state: EditorState, locals: any, at: number) {
  let scope = localsToScope(locals)
  let known = new Set<string>(jsBuiltins)
  for (let k of Object.keys(scope)) known.add(k)
  for (let b of collectEjsScriptBindings(state, at)) known.add(b)
  for (let k of Object.keys(inferCallbackBindingShapes(state, scope, at))) known.add(k)
  return known
}

function braceBalance(text: string) {
  let bal = 0, quote = "", esc = false
  for (let i = 0; i < text.length; i++) {
    let ch = text[i]
    if (quote) {
      if (esc) esc = false
      else if (ch == "\\") esc = true
      else if (ch == quote) quote = ""
      continue
    }
    if (ch == "'" || ch == '"' || ch == "`") { quote = ch; continue }
    if (ch == "{") bal++
    else if (ch == "}") bal--
  }
  return bal
}

/** Tags that only continue a block opened earlier (} else {, }), …). */
function isContinuationFragment(text: string) {
  let t = text.trim()
  return /^[\}\)]/.test(t) || /^(else|catch|finally)\b/.test(t) || /^(case|default)\b/.test(t)
}

function tagJsRanges(state: EditorState) {
  let ranges: {from: number, to: number, balanced: boolean, continuation: boolean}[] = []
  let tree = syntaxTree(state)
  let doc = state.doc
  tree.iterate({
    enter(node) {
      if (node.name != "Scriptlet" && node.name != "EscapedOutput" && node.name != "RawOutput")
        return
      let open = node.node.firstChild
      let close = node.node.lastChild
      if (!open || !close || open == close) return
      let from = open.to, to = close.from
      if (to < from) return
      let text = doc.sliceString(from, to)
      ranges.push({from, to, balanced: braceBalance(text) == 0, continuation: isContinuationFragment(text)})
    }
  })
  return ranges
}

function pushErrorDiagnostics(state: EditorState, diagnostics: Diagnostic[], checkSyntax: boolean) {
  if (!checkSyntax) return
  let ranges = tagJsRanges(state)
  let tree = syntaxTree(state)
  tree.iterate({
    enter(node) {
      if (!node.type.isError) return
      let from = node.from, to = Math.max(node.to, node.from + 1)
      if (to > state.doc.length) to = state.doc.length
      if (from >= state.doc.length) return

      let inJs = false
      for (let p = node.node.parent; p; p = p.parent) {
        if (p.name == "Script" || p.name == "SingleExpression") { inJs = true; break }
      }
      if (inJs) {
        let range = ranges.find(r => from >= r.from && from <= r.to)
        if (!range || !range.balanced || range.continuation) return
        diagnostics.push({
          from, to,
          severity: "error",
          message: "JavaScript syntax error",
          source: "javascript"
        })
        return
      }

      diagnostics.push({
        from, to,
        severity: "error",
        message: "EJS syntax error",
        source: "ejs"
      })
    }
  })
}

function pushUndefinedDiagnostics(state: EditorState, diagnostics: Diagnostic[], locals: any) {
  let tree = syntaxTree(state)
  let doc = state.doc
  tree.iterate({
    enter(node) {
      if (node.name != "VariableName") return
      if (node.node.parent && /Definition$/.test(node.node.parent.name)) return
      let name = doc.sliceString(node.from, node.to)
      if (jsKeywords.has(name)) return
      let known = collectKnownNames(state, locals, node.from)
      if (known.has(name)) return
      diagnostics.push({
        from: node.from,
        to: node.to,
        severity: "warning",
        message: "'" + name + "' is not defined in template locals or earlier EJS script",
        source: "ejs"
      })
    }
  })
}

export function ejsDiagnostics(state: EditorState, config: {
  locals?: any
  checkUndefined?: boolean
  checkSyntax?: boolean
} = {}): Diagnostic[] {
  let diagnostics: Diagnostic[] = []
  pushErrorDiagnostics(state, diagnostics, config.checkSyntax !== false)
  if (config.checkUndefined !== false)
    pushUndefinedDiagnostics(state, diagnostics, config.locals)
  return diagnostics
}

export function ejsLintSource(config: {
  locals?: any
  checkUndefined?: boolean
  checkSyntax?: boolean
} = {}) {
  return (view: EditorView): readonly Diagnostic[] => ejsDiagnostics(view.state, config)
}

export function ejsLint(config: {
  locals?: any
  checkUndefined?: boolean
  checkSyntax?: boolean
  delay?: number
} = {}): Extension {
  return [
    lintGutter(),
    linter(ejsLintSource(config), {delay: config.delay ?? 250})
  ]
}