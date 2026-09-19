import {EditorState} from "@codemirror/state"
import {syntaxTree} from "@codemirror/language"
import {Completion} from "@codemirror/autocomplete"

const definitionNames = new Set([
  "VariableDefinition",
  "PropertyDefinition",
  "ClassDefinition"
])

export function collectEjsScriptBindings(state: EditorState, before = state.doc.length): string[] {
  let tree = syntaxTree(state)
  let doc = state.doc
  let names = new Set<string>()
  tree.iterate({
    from: 0,
    to: before,
    enter(node) {
      if (node.from >= before) return false
      if (definitionNames.has(node.name)) {
        let text = doc.sliceString(node.from, node.to)
        if (/^[\w$][\w$\d]*$/.test(text)) names.add(text)
      }
    }
  })
  return Array.from(names)
}

export function inferCallbackBindingShapes(
  state: EditorState,
  locals: any,
  before = state.doc.length
): Record<string, any> {
  let text = state.doc.sliceString(0, before)
  let inferred: Record<string, any> = Object.create(null)
  if (!locals) return inferred
  let re =
    /([A-Za-z_$][\w$]*)\s*\.\s*(?:forEach|map|filter|find|every|some|flatMap)\s*\(\s*(?:function\s*)?\(?\s*([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(text))) {
    let arrName = m[1], param = m[2]
    let arr = locals[arrName]
    if (Array.isArray(arr) && arr.length > 0) inferred[param] = arr[0]
  }
  return inferred
}

export function localsToScope(locals: any): any {
  if (!locals) return Object.create(null)
  if (Array.isArray(locals)) {
    let scope: any = Object.create(null)
    for (let item of locals) {
      if (typeof item == "string") scope[item] = ""
      else if (item && typeof item == "object" && item.label) {
        scope[item.label] = (item as Completion).detail ?? ""
      }
    }
    return scope
  }
  return locals
}

export function mergeLocalsWithBindings(
  locals: any,
  bindings: readonly string[],
  inferred: Record<string, any> = Object.create(null)
) {
  let scope = Object.assign(Object.create(null), localsToScope(locals), inferred)
  for (let name of bindings) {
    if (!(name in scope)) scope[name] = undefined
  }
  return scope
}

export function buildCompletionScope(state: EditorState, locals: any, before: number) {
  let base = localsToScope(locals)
  let bindings = collectEjsScriptBindings(state, before)
  let inferred = inferCallbackBindingShapes(state, base, before)
  return mergeLocalsWithBindings(base, bindings, inferred)
}

export function isEjsTagType(name: string) {
  return name == "Scriptlet" || name == "EscapedOutput" || name == "RawOutput" || name == "Comment"
}