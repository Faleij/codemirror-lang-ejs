import ist from "ist"
import {EditorState} from "@codemirror/state"
import {ejsLanguage} from "@faleij/codemirror-lang-ejs"
import {ensureSyntaxTree} from "@codemirror/language"
import {Tree, SyntaxNode, IterMode} from "@lezer/common"

function s(doc: string) {
  return EditorState.create({doc, extensions: [ejsLanguage.extension]})
}

function tr(state: EditorState) {
  return ensureSyntaxTree(state, state.doc.length, 1e9)!
}

function hasNode(tree: Tree, name: string) {
  let found = false
  tree.iterate({enter(node) { if (node.name == name) found = true }})
  return found
}

function countNodes(tree: Tree, name: string) {
  let n = 0
  tree.iterate({enter(node) { if (node.name == name) n++ }})
  return n
}

function findNode(tree: Tree, name: string): SyntaxNode | null {
  let found: SyntaxNode | null = null
  tree.iterate({enter(node) {
    if (!found && node.name == name) found = node.node
  }})
  return found
}

function hasOuterError(tree: Tree) {
  // Ignore errors inside mounted JS/HTML — EJS often splits JS across tags
  // (e.g. `<% for { %>` … `<% } %>`), which leaves incomplete JS fragments.
  let err = false
  tree.iterate({
    enter(node) { if (node.type.isError) err = true },
    mode: IterMode.IgnoreMounts
  })
  return err
}

describe("ejs syntax", () => {
  it("returns a tree for plain HTML text", () => {
    let doc = "<h1>Hello</h1>", state = s(doc), tree = tr(state)
    ist(tree instanceof Tree)
    ist(tree.type.name, "Template")
    ist(tree.length, state.doc.length)
    ist(hasNode(tree, "Text"))
  })

  it("parses escaped output tags", () => {
    let doc = "Hello <%= name %>", tree = tr(s(doc))
    ist(hasNode(tree, "EscapedOutput"))
    ist(hasNode(tree, "OpenEscaped"))
    ist(hasNode(tree, "SingleExpression") || hasNode(tree, "VariableName"))
    ist(hasNode(tree, "Close"))
  })

  it("parses raw output tags", () => {
    let doc = "<%= a %><%- rawHtml %>", tree = tr(s(doc))
    ist(hasNode(tree, "RawOutput"))
    ist(hasNode(tree, "OpenRaw"))
    ist(countNodes(tree, "EscapedOutput"), 1)
  })

  it("parses scriptlet tags", () => {
    let doc = "<% if (user) { %>hi<% } %>", tree = tr(s(doc))
    ist(hasNode(tree, "Scriptlet"))
    ist(hasNode(tree, "OpenScript"))
    ist(countNodes(tree, "Scriptlet"), 2)
  })

  it("parses whitespace-slurp scriptlets", () => {
    let doc = "<%_ if (x) { _%>", tree = tr(s(doc))
    ist(hasNode(tree, "Scriptlet"))
    ist(hasNode(tree, "Close"))
  })

  it("parses comment tags", () => {
    let doc = "<%# this is a comment %>", tree = tr(s(doc))
    ist(hasNode(tree, "Comment"))
    ist(hasNode(tree, "OpenComment"))
    ist(hasNode(tree, "CommentContent"))
  })

  it("parses newline-trim closing tags", () => {
    let doc = "<% if (1) { -%>\nline", tree = tr(s(doc))
    ist(hasNode(tree, "Scriptlet"))
    ist(hasNode(tree, "Close"))
  })

  it("parses literal escape tags", () => {
    let doc = "Use <%% and %%> in docs", tree = tr(s(doc))
    ist(hasNode(tree, "LiteralOpen"))
    ist(hasNode(tree, "LiteralClose"))
  })

  it("handles mixed HTML and EJS from the EJS README example", () => {
    let doc = `<% if (user) { %>
  <h2><%= user.name %></h2>
<% } %>`
    let tree = tr(s(doc))
    ist(hasNode(tree, "Scriptlet"))
    ist(hasNode(tree, "EscapedOutput"))
    ist(hasNode(tree, "Text"))
    ist(tree.length, doc.length)
  })

  it("keeps the tree covering the full document through edits", () => {
    let state = s("<% let x = 1 %>")
    ist(tr(state).length, state.doc.length)
    state = state.update({changes: {from: 0, to: 0, insert: "<p>"}}).state
    let tree = tr(state)
    ist(tree.length, state.doc.length)
    ist(hasNode(tree, "Text"))
    ist(hasNode(tree, "Scriptlet"))
  })

  it("does not leave outer error nodes on well-formed templates", () => {
    let docs = [
      "<% %>",
      "<%= 1 + 2 %>",
      "<%- include('x') %>",
      "<%# comment %>",
      "<%_ foo _%>",
      "text <%% literal %%> more",
      "<div><%= title %></div>",
      `<% for (let i = 0; i < items.length; i++) { %>
  <li><%= items[i] %></li>
<% } %>`
    ]
    for (let doc of docs) {
      let tree = tr(s(doc))
      ist(hasOuterError(tree), false)
      ist(tree.length, doc.length)
    }
  })

  it("exposes nested JS for output expressions", () => {
    let doc = "<%= user.name %>", tree = tr(s(doc))
    ist(hasNode(tree, "EscapedOutput"))
    ist(hasNode(tree, "MemberExpression") || hasNode(tree, "VariableName"))
    let open = findNode(tree, "OpenEscaped")
    ist(!!open)
    ist(doc.slice(open!.from, open!.to), "<%=")
  })

  it("covers mixed HTML host text without outer errors", () => {
    let doc = "<div class=\"x\"><%= title %></div>"
    let tree = tr(s(doc))
    ist(hasNode(tree, "EscapedOutput"))
    ist(hasOuterError(tree), false)
    ist(tree.length, doc.length)
  })
})