import {ExternalTokenizer} from "@lezer/lr"
import {Text, Content, CommentContent} from "./ejs.grammar.terms"

const enum Ch {
  Dash = 45,
  Percent = 37,
  Lt = 60,
  Gt = 62,
  Underscore = 95
}

function isCloseStart(input: {next: number, peek: (n: number) => number}) {
  if (input.next == Ch.Percent && input.peek(1) == Ch.Gt) return true
  if ((input.next == Ch.Dash || input.next == Ch.Underscore) &&
      input.peek(1) == Ch.Percent && input.peek(2) == Ch.Gt) return true
  return false
}

export const text = new ExternalTokenizer(input => {
  let start = input.pos
  for (;;) {
    if (input.next < 0) break
    // Start of an EJS open tag (<% …)
    if (input.next == Ch.Lt && input.peek(1) == Ch.Percent) break
    // Literal escaped close tag (%%>)
    if (input.next == Ch.Percent && input.peek(1) == Ch.Percent && input.peek(2) == Ch.Gt) break
    input.advance()
  }
  if (input.pos > start) input.acceptToken(Text)
})

function contentTokenizer(token: number) {
  return new ExternalTokenizer(input => {
    let start = input.pos
    for (;;) {
      if (input.next < 0) break
      if (isCloseStart(input)) break
      input.advance()
    }
    if (input.pos > start) input.acceptToken(token)
  })
}

export const content = contentTokenizer(Content)
export const commentContent = contentTokenizer(CommentContent)