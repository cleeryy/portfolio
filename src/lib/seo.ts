/**
 * Document metadata for the current plate.
 *
 * The strings are supplied by the caller (App, or a project file later) so this
 * module never imports copy: `document.title`, the description, and the two
 * Open Graph tags that already exist in `index.html`. A missing tag is created
 * for the description and left alone for Open Graph — social cards are baked at
 * build time, not invented at runtime.
 *
 * A single-page site has one HTML document for every address, so two tags have
 * to be written by hand on each route or they lie:
 *
 * - `link[rel=canonical]` — without it, a share of `/#statement` competes with
 *   `/` in an index that only ever fetched one file.
 * - `meta[name=robots]` — the missing plate is served with a 200 (there is no
 *   server render to answer 404), so it must say `noindex` itself, and every
 *   real plate must clear that tag again on the way back.
 */
export function setMeta(
  title: string,
  description: string,
  options: { index?: boolean } = {},
): void {
  document.title = title

  let descriptionTag = document.querySelector('meta[name="description"]')
  if (!descriptionTag) {
    descriptionTag = document.createElement('meta')
    descriptionTag.setAttribute('name', 'description')
    document.head.appendChild(descriptionTag)
  }
  descriptionTag.setAttribute('content', description)

  setProperty('og:title', title)
  setProperty('og:description', description)
  setProperty('og:url', canonical())

  const link = canonicalTag()
  link.setAttribute('href', canonical())

  if (options.index === false) setNamed('robots', 'noindex, follow')
  else if (options.index === true) setNamed('robots', 'index, follow')
}

function canonical(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function canonicalTag(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (existing) return existing

  const link = document.createElement('link')
  link.setAttribute('rel', 'canonical')
  document.head.appendChild(link)
  return link
}

function setNamed(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setProperty(property: string, content: string): void {
  const tag = document.querySelector(`meta[property="${property}"]`)
  if (tag) tag.setAttribute('content', content)
}
