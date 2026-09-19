# @faleij/codemirror-lang-ejs

EJS language support for CodeMirror 6 with mixed HTML/JS parsing, autocomplete, and optional lint.

**Live playground:** https://faleij.github.io/codemirror-lang-ejs/

## Usage

```js
import {ejs} from "@faleij/codemirror-lang-ejs"

const locals = {
  title: "Dashboard",
  user: {name: "Ada", email: "ada@example.com"},
  items: [{html: "<b>One</b>", id: 1}]
}

ejs({
  locals,
  lint: true // gutter: syntax errors + undefined names
})
```

Inside tags, completions include `locals`, cross-tag bindings (e.g. `item` from
`items.forEach(function(item)`), and inferred properties for foreach/map callbacks.

## Playground

Try it online at https://faleij.github.io/codemirror-lang-ejs/, or run locally:

```bash
npm run example
```

## API

- `ejs({ base?, locals?, lint? })`
- `ejsLanguage`, `ejsCompletionSource`, `ejsJavaScriptCompletionSource`
- `ejsLocalsCompletionSource`, `ejsScriptBindingsCompletionSource`
- `ejsLint` / `ejsLintSource` / `ejsDiagnostics`

## CI / Pages / npm

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages setup, npm Trusted Publishing, and how PR CI is kept separate from deploy jobs.