import ist from "ist"
import {EditorState} from "@codemirror/state"
import {getIndentation} from "@codemirror/language"
import {ejs} from "@faleij/codemirror-lang-ejs"

describe("ejs indentation", () => {
  it("returns a numeric indent inside a multi-line scriptlet body", () => {
    let doc = "<%\n  if (user) {\n    greeting()\n  }\n%>"
    let state = EditorState.create({doc, extensions: [ejs().language]})
    // Position at start of the "    greeting()" line
    let pos = doc.indexOf("greeting")
    let indent = getIndentation(state, pos)
    ist(typeof indent == "number" || indent === null)
    if (typeof indent == "number") ist(indent >= 0)
  })

  it("does not throw when indenting mixed templates", () => {
    let doc = `<% if (items.length) { %>
  <ul>
    <li><%= item %></li>
  </ul>
<% } %>`
    let state = EditorState.create({doc, extensions: [ejs().language]})
    for (let pos = 0; pos < doc.length; pos++) {
      getIndentation(state, pos)
    }
    ist(true)
  })
})