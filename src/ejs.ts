import {parser as ejsParse} from "./ejs.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside,
        delimitedIndent} from "@codemirror/language"
import {html, htmlLanguage} from "@codemirror/lang-html"
import {javascriptLanguage, javascript, scopeCompletionSource} from "@codemirror/lang-javascript"
import {styleTags, tags as t} from "@lezer/highlight"
import {parseMixed} from "@lezer/common"
import {Extension} from "@codemirror/state"
import {
  ejsCompletionSource, ejsJavaScriptCompletionSource,
  ejsLocalsCompletionSource, ejsScriptBindingsCompletionSource, localsToScope
} from "./complete"
import {ejsLint} from "./lint"

const exprParser = javascriptLanguage.parser.configure({
  top: "SingleExpression"
})

const statementMixed = {parser: javascriptLanguage.parser}
const expressionMixed = {parser: exprParser}

/// A language provider based on the EJS template grammar, with HTML
/// overlay parsing for host text and JavaScript parsing inside tags
/// (see the [mixed-language](https://codemirror.net/examples/mixed-language/)
/// guide).
export const ejsLanguage = LRLanguage.define({
  name: "ejs",
  parser: ejsParse.configure({
    props: [
      indentNodeProp.add({
        Scriptlet(context) {
          let closed = /^\s*%>/.test(context.textAfter) || /^\s*-%>/.test(context.textAfter) ||
            /^\s*_%>/.test(context.textAfter)
          return context.lineIndent(context.node.from) + (closed ? 0 : context.unit)
        },
        EscapedOutput: delimitedIndent({closing: "%>"}),
        RawOutput: delimitedIndent({closing: "%>"}),
        Comment: () => null
      }),
      foldNodeProp.add({
        Scriptlet: foldInside,
        EscapedOutput: foldInside,
        RawOutput: foldInside,
        Comment: foldInside
      }),
      styleTags({
        Text: t.content,
        "OpenEscaped OpenRaw OpenComment OpenScript Close LiteralOpen LiteralClose": t.meta,
        CommentContent: t.blockComment,
        "EscapedOutput/Content RawOutput/Content": t.special(t.string),
        "Scriptlet/Content": t.special(t.string)
      })
    ],
    wrap: parseMixed(node => {
      if (node.type.isTop) {
        return {
          parser: htmlLanguage.parser,
          overlay: n => n.name == "Text"
        }
      }
      if (node.name == "Content") {
        let parent = node.node.parent?.name
        if (parent == "Scriptlet") return statementMixed
        if (parent == "EscapedOutput" || parent == "RawOutput") return expressionMixed
      }
      return null
    })
  }),
  languageData: {
    commentTokens: {block: {open: "<%#", close: "%>"}},
    closeBrackets: {brackets: ["(", "[", "{", "'", '"', "`"]},
    autocomplete: ejsCompletionSource
  }
})

const baseHTML = html()

/// EJS template language support.
export function ejs(config: {
  /// Provide an HTML language configuration to use as a base.
  base?: LanguageSupport
  /// Template locals available inside EJS tags (same shape as
  /// `ejs.render(template, locals)`).
  locals?: any
  /// When true, include lint gutter + diagnostics for EJS/JS syntax
  /// errors and undefined identifiers (VS Code-style).
  lint?: boolean | {checkUndefined?: boolean, checkSyntax?: boolean, delay?: number}
} = {}) {
  let base = baseHTML
  if (config.base) {
    if (config.base.language.name != "html" || !(config.base.language instanceof LRLanguage))
      throw new RangeError("The base option must be the result of calling html(...)")
    base = config.base
  }

  let scope = config.locals != null ? localsToScope(config.locals) : null

  let extensions: Extension[] = [
    base.support,
    javascript().support,
    ejsLanguage.data.of({autocomplete: ejsCompletionSource}),
    ejsLanguage.data.of({autocomplete: ejsScriptBindingsCompletionSource}),
    ejsLanguage.data.of({autocomplete: ejsJavaScriptCompletionSource})
  ]

  if (scope) {
    let localsSource = ejsLocalsCompletionSource(scope)
    extensions.push(ejsLanguage.data.of({autocomplete: localsSource}))
    extensions.push(javascriptLanguage.data.of({autocomplete: scopeCompletionSource(scope)}))
  }

  if (config.lint) {
    let lintConf = config.lint === true ? {} : config.lint
    extensions.push(ejsLint({locals: scope, ...lintConf}))
  }

  return new LanguageSupport(ejsLanguage, extensions)
}

export {
  ejsCompletionSource,
  ejsJavaScriptCompletionSource,
  ejsLocalsCompletionSource,
  ejsScriptBindingsCompletionSource,
  localsToScope,
  inEjsJavaScript,
  collectEjsScriptBindings,
  mergeLocalsWithBindings,
  inferCallbackBindingShapes
} from "./complete"

export {ejsLint, ejsLintSource, ejsDiagnostics} from "./lint"