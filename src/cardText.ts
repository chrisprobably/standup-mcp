const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function editorJsBlockTexts(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.blocks)) {
      return parsed.blocks.map((block: { data?: { text?: string } }) => block.data?.text ?? '');
    }
  } catch {
    // plain text or markdown card
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity]);
}

export function plainCardText(text: string): string {
  const blocks = editorJsBlockTexts(text);
  return blocks ? blocks.join(' ').replace(/<[^>]+>/g, '') : text;
}

export function firstLineOfCardText(text: string): string {
  const lines = (editorJsBlockTexts(text) ?? [text]).flatMap((block) => htmlToText(block).split('\n'));
  return lines.map((line) => line.trim()).find((line) => line.length > 0) ?? '';
}
