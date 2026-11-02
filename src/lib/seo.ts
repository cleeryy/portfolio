/**
 * Document metadata for the current plate.
 *
 * The strings are supplied by the caller (App, or a project file later) so this
 * module never imports copy: `document.title`, the description, and the two
 * Open Graph tags that already exist in `index.html`. A missing tag is created
 * for the description and left alone for Open Graph — social cards are baked at
 * build time, not invented at runtime.
 */
export function setMeta(title: string, description: string): void {
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
}

function setProperty(property: string, content: string): void {
  const tag = document.querySelector(`meta[property="${property}"]`)
  if (tag) tag.setAttribute('content', content)
}
