/** Small helpers, so the pages read as structure rather than as plumbing. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const c of children) node.append(c)
  return node
}

/** A block of code, marked left-to-right whatever the page around it. */
export function codeBlock(text: string): HTMLElement {
  return el('pre', { class: 'code', dir: 'ltr' }, text)
}
