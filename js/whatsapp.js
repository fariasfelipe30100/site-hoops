export function buildWhatsappUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function applyWhatsappLinks(root, number, messages) {
  let changed = 0;
  for (const link of root.querySelectorAll('a[data-wa]')) {
    const key = link.getAttribute('data-wa');
    if (!Object.hasOwn(messages, key)) continue;
    link.setAttribute('href', buildWhatsappUrl(number, messages[key]));
    changed += 1;
  }
  return changed;
}
