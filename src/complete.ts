import {
  Completion, CompletionContext, CompletionResult, CompletionSource,
  completeFromList, ifNotIn, snippetCompletion as snip
} from "@codemirror/autocomplete"
import {syntaxTree} from "@codemirror/language"
import {
  snippets, localCompletionSource, scopeCompletionSource, completionPath
} from "@codemirror/lang-javascript"
import {
  collectEjsScriptBindings, buildCompletionScope, localsToScope
} from "./scope"

const tagSnippets = [
  snip("<% ${} %>", {label: "<% %>", type: "keyword", detail: "scriptlet"}),
  snip("<%= ${} %>", {label: "<%= %>", type: "keyword", detail: "escaped output"}),
  snip("<%- ${} %>", {label: "<%- %>", type: "keyword", detail: "raw output"}),
  snip("<%# ${} %>", {label: "<%# %>", type: "keyword", detail: "comment"}),
  snip("<%_ ${} _%>", {label: "<%_ _%>", type: "keyword", detail: "whitespace-slurp scriptlet"}),
  snip("<% if (${}) { %>\n  ${}\n<% } %>", {label: "if", type: "keyword", detail: "EJS if block"}),
  snip("<% for (let ${i} = 0; ${i} < ${items}.length; ${i}++) { %>\n  ${}\n<% } %>", {
    label: "for", type: "keyword", detail: "EJS for block"
  }),
  snip("<%- include('${}') %>", {label: "include", type: "function", detail: "EJS include"})
]

const jsKeywords = "break case const continue default delete export extends false finally in instanceof let new return static super switch this throw true typeof var yield await async class function"
  .split(" ")
  .map(name => ({label: name, type: "keyword"} as Completion))

const jsCompletions = completeFromList(snippets.concat(jsKeywords))

export function inEjsJavaScript(context: CompletionContext) {
  let tree = syntaxTree(context.state)
  let outer = tree.resolve(context.pos, -1)
  if (/^Open(Script|Escaped|Raw|Comment)$/.test(outer.name)) return false
  for (let n: typeof outer | null = outer; n; n = n.parent) {
    if (n.name == "CommentContent" || n.name == "Comment") return false
    if (n.name == "Content") {
      let parent = n.parent?.name
      return parent == "Scriptlet" || parent == "EscapedOutput" || parent == "RawOutput"
    }
  }
  let inner = tree.resolveInner(context.pos, -1)
  for (let n: typeof inner | null = inner; n; n = n.parent) {
    if (n.name == "Script" || n.name == "SingleExpression") return true
  }
  return false
}

function inHtmlElement(context: CompletionContext) {
  let inner = syntaxTree(context.state).resolveInner(context.pos, -1)
  for (let n: typeof inner | null = inner; n; n = n.parent) {
    if (n.name == "Element" || n.name == "OpenTag" || n.name == "CloseTag" ||
        n.name == "SelfClosingTag" || n.name == "AttributeName" ||
        n.name == "AttributeValue" || n.name == "TagName" ||
        n.name == "ScriptText" || n.name == "StyleText") return true
  }
  return false
}

function ownProps(obj: any): Completion[] {
  if (!obj || typeof obj != "object") return []
  return Object.keys(obj).map(label => ({
    label,
    type: typeof obj[label] == "function" ? "method" : "property"
  } as Completion))
}

export function ejsCompletionSource(context: CompletionContext): CompletionResult | null {
  if (inEjsJavaScript(context) || inHtmlElement(context)) return null
  let {state, pos} = context
  let line = state.doc.lineAt(pos)
  let textBefore = line.text.slice(0, pos - line.from)
  let match = /(?:^|[\s>])(<[%_=-]?)$/.exec(textBefore)
  if (!match && !context.explicit) return null
  let from = match ? pos - match[1].length : pos
  return {from, options: tagSnippets, validFor: /^<[%_=-]*$/}
}

export function ejsJavaScriptCompletionSource(context: CompletionContext): CompletionResult | null {
  if (!inEjsJavaScript(context)) return null
  // Don't flood property-completion contexts with every JS keyword.
  let path = completionPath(context)
  if (path && path.path.length) return null
  let local = localCompletionSource(context)
  if (local && local.options.length) return local
  return ifNotIn([
    "TemplateString", "String", "Comment", "LineComment", "BlockComment"
  ], jsCompletions)(context)
}

export function ejsScriptBindingsCompletionSource(context: CompletionContext): CompletionResult | null {
  if (!inEjsJavaScript(context)) return null
  let path = completionPath(context)
  if (!path || path.path.length) return null
  let bindings = collectEjsScriptBindings(context.state, context.pos)
  if (!bindings.length) return null
  return completeFromList(bindings.map(label => ({label, type: "variable"} as Completion)))(context)
}

/// Locals + cross-tag bindings + foreach property inference.
export function ejsLocalsCompletionSource(locals: any): CompletionSource {
  return (context: CompletionContext) => {
    if (!inEjsJavaScript(context)) return null
    let scope = buildCompletionScope(context.state, locals, context.pos)
    let path = completionPath(context)
    if (path && path.path.length) {
      let target: any = scope
      for (let step of path.path) {
        target = target?.[step]
        if (target == null) return null
      }
      let options = ownProps(target)
      if (!options.length) return null
      return {
        from: context.pos - path.name.length,
        options,
        validFor: /^[\w$]*$/
      }
    }
    return scopeCompletionSource(scope)(context)
  }
}

export {localsToScope, collectEjsScriptBindings, mergeLocalsWithBindings, inferCallbackBindingShapes, buildCompletionScope} from "./scope"