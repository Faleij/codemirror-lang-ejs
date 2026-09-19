import {EditorView, basicSetup} from "codemirror"
import {keymap} from "@codemirror/view"
import {autocompletion, startCompletion, completionKeymap} from "@codemirror/autocomplete"
import {
  ejs,
  ejsCompletionSource,
  ejsJavaScriptCompletionSource,
  ejsLocalsCompletionSource,
  ejsScriptBindingsCompletionSource
} from "@faleij/codemirror-lang-ejs"

export const templateLocals = {
  title: "Dashboard",
  user: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    isAdmin: true
  },
  items: [
    {html: "<b>One</b>", id: 1},
    {html: "<i>Two</i>", id: 2}
  ]
}

const sample = `<%# Playground: Ctrl/Cmd-Space = autocomplete; gutter = lint %>
<%# Locals from templateLocals. Try typing item. after the forEach. %>
<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
  <style>
    body { font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <% if (user) { %>
    <h1>Hello, <%= user.name %>!</h1>
    <p><%= user.email %></p>
    <ul>
      <% items.forEach(function(item) { %>
        <li><%- item.html %></li>
      <% }) %>
    </ul>
  <% } else { %>
    <p>Please log in.</p>
  <% } %>

  <%# Demo lint: undefined name + broken JS in a balanced tag %>
  <p><%= doesNotExist %></p>
  <% let broken = %>

  <script>
    console.log(<%= JSON.stringify(user || null) %>)
  </script>
</body>
</html>
`

const storageKey = "codemirror-lang-ejs-example-doc-v4"
const doc = window.localStorage.getItem(storageKey) || sample

const persist = EditorView.updateListener.of(update => {
  if (update.docChanged)
    window.localStorage.setItem(storageKey, update.state.doc.toString())
})

new EditorView({
  doc,
  extensions: [
    basicSetup,
    ejs({
      locals: templateLocals,
      lint: true
    }),
    autocompletion({
      activateOnTyping: true,
      override: [
        ejsCompletionSource,
        ejsLocalsCompletionSource(templateLocals),
        ejsScriptBindingsCompletionSource,
        ejsJavaScriptCompletionSource
      ]
    }),
    keymap.of([
      {key: "Mod-Space", run: startCompletion},
      ...completionKeymap
    ]),
    persist,
    EditorView.theme({
      "&": {height: "100%"},
      ".cm-content": {padding: "12px 0"},
      ".cm-gutters": {backgroundColor: "transparent", border: "none"}
    })
  ],
  parent: document.querySelector("#editor")
})