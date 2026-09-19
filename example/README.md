# EJS playground

```bash
npm install
npm run example
```

Open http://127.0.0.1:4173

## Locals + lint

`example/editor.mjs` shows the integration:

```js
import {ejs} from "@faleij/codemirror-lang-ejs"

export const templateLocals = {
  title: "Dashboard",
  user: {name: "Ada", email: "ada@example.com"},
  items: [{html: "<b>One</b>", id: 1}]
}

ejs({
  locals: templateLocals,
  lint: true // gutter diagnostics like VS Code
})
```

Inside tags, completions include those locals, names declared in earlier
scriptlets (e.g. `item` from `items.forEach(function(item)`), and
inferred property shapes for foreach/map callbacks.