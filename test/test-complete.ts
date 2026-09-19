import ist from "ist"
import {EditorState} from "@codemirror/state"
import {CompletionContext} from "@codemirror/autocomplete"
import {
  ejs, ejsLanguage, ejsCompletionSource, ejsJavaScriptCompletionSource,
  ejsLocalsCompletionSource, ejsScriptBindingsCompletionSource,
  inEjsJavaScript, collectEjsScriptBindings, ejsDiagnostics
} from "@faleij/codemirror-lang-ejs"
import {htmlLanguage} from "@codemirror/lang-html"
import {javascriptLanguage} from "@codemirror/lang-javascript"

const locals = {
  title: "Dashboard",
  user: {name: "Ada", email: "ada@example.com"},
  items: [{html: "<b>One</b>", id: 1}]
}

function state(doc: string, extensions = [ejs({locals, lint: true})]) {
  return EditorState.create({doc, extensions})
}

function atEnd(doc: string, explicit = true) {
  let s = state(doc)
  return {s, ctx: new CompletionContext(s, doc.length, explicit)}
}

describe("ejs mixed-language support", () => {
  it("exports a LanguageSupport that includes nested HTML and JS support", () => {
    let support = ejs()
    ist(support.language, ejsLanguage)
    ist(support.support.length > 0)
    ist(!!htmlLanguage)
    ist(!!javascriptLanguage)
  })

  it("registers EJS autocomplete on language data", () => {
    let s = state("<%=")
    let data = s.languageDataAt<{autocomplete?: Function}>("autocomplete", 0)
    ist(data.some(d => d === ejsCompletionSource || (d as any)?.name == ejsCompletionSource.name))
  })
})

describe("ejsCompletionSource", () => {
  it("suggests EJS tag snippets when typing <%", () => {
    let {ctx} = atEnd("Hello <%", true)
    let result = ejsCompletionSource(ctx)
    ist(!!result)
    ist(result!.options.some(o => o.label == "<%= %>"))
  })

  it("suggests snippets on explicit completion in plain host text", () => {
    let {ctx} = atEnd("Hello ", true)
    ist(!!ejsCompletionSource(ctx))
  })

  it("defers inside nested HTML overlay elements", () => {
    let {ctx} = atEnd("<div>", true)
    ist(ejsCompletionSource(ctx), null)
  })

  it("defers tag snippets inside nested JS expression mounts", () => {
    let {ctx} = atEnd("<%= user.", true)
    ist(ejsCompletionSource(ctx), null)
  })
})

describe("ejs JavaScript and locals completion", () => {
  it("detects JS regions inside EJS tags", () => {
    ist(inEjsJavaScript(atEnd("<%= use", true).ctx))
    ist(inEjsJavaScript(atEnd("Hello ", true).ctx), false)
  })

  it("suggests JS keywords inside scriptlets", () => {
    let result = ejsJavaScriptCompletionSource(atEnd("<% con", true).ctx)
    ist(!!result)
    ist(result!.options.some(o => o.label == "const" || o.label == "continue"))
  })

  it("suggests template locals inside output tags", () => {
    let result = ejsLocalsCompletionSource(locals)(atEnd("<%= use", true).ctx)
    ist(!!result)
    ist(result!.options.some(o => o.label == "user"))
  })

  it("suggests nested properties from locals", () => {
    let result = ejsLocalsCompletionSource(locals)(atEnd("<%= user.", true).ctx)
    ist(!!result)
    ist(result!.options.some(o => o.label == "name"))
  })

  it("completes cross-tag foreach callback bindings", () => {
    let doc = "<% items.forEach(function(item) { %><%- ite"
    let {s, ctx} = atEnd(doc, true)
    let bindings = collectEjsScriptBindings(s, doc.length)
    ist(bindings.indexOf("item") >= 0)
    let fromBindings = ejsScriptBindingsCompletionSource(ctx)
    ist(!!fromBindings)
    ist(fromBindings!.options.some(o => o.label == "item"))
    let fromLocals = ejsLocalsCompletionSource(locals)(ctx)
    ist(!!fromLocals)
    ist(fromLocals!.options.some(o => o.label == "item"))
  })

  it("infers foreach callback property completion from array locals", () => {
    let doc = "<% items.forEach(function(item) { %><%- item."
    let result = ejsLocalsCompletionSource(locals)(atEnd(doc, true).ctx)
    ist(!!result)
    ist(result!.options.some(o => o.label == "html"))
    ist(result!.options.some(o => o.label == "id"))
  })

  it("does not offer locals outside EJS JS regions", () => {
    ist(ejsLocalsCompletionSource(locals)(atEnd("Hello use", true).ctx), null)
  })
})


describe("ejs lint", () => {
  it("reports undefined identifiers", () => {
    let diags = ejsDiagnostics(state("<%= doesNotExist %>"), {locals})
    ist(diags.some(d => d.severity == "warning" && /doesNotExist/.test(d.message)))
  })

  it("reports JS syntax errors in brace-balanced tags", () => {
    let diags = ejsDiagnostics(state("<% let x = %>"), {locals})
    ist(diags.some(d => d.severity == "error" && /JavaScript/.test(d.message)))
  })

  it("does not flag cross-tag control-flow fragments as errors", () => {
    let doc = "<% if (user) { %><p>x</p><% } %>"
    let diags = ejsDiagnostics(state(doc), {locals, checkUndefined: false})
    ist(diags.filter(d => d.severity == "error").length, 0)
  })

  it("does not warn for known locals or foreach bindings", () => {
    let doc = "<% items.forEach(function(item) { %><%- item.html %><% }) %>"
    let diags = ejsDiagnostics(state(doc), {locals})
    ist(diags.filter(d => d.severity == "warning").length, 0)
  })
})