const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

type EditorJsBlock = { data?: { text?: unknown; items?: unknown } } | null;

function editorJsBlocks(text: string): EditorJsBlock[] | null {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.blocks) ? parsed.blocks : null;
  } catch {
    return null;
  }
}

function listItemText(item: unknown): string | null {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return null;
  const { content, text } = item as { content?: unknown; text?: unknown };
  if (typeof content === 'string') return content;
  return typeof text === 'string' ? text : null;
}

function blockText(block: EditorJsBlock): string | null {
  const data = block?.data;
  if (typeof data?.text === 'string') return data.text;
  return Array.isArray(data?.items) ? listItemText(data.items[0]) : null;
}

function blockTexts(blocks: EditorJsBlock[]): string[] {
  return blocks.map(blockText).filter((text): text is string => text !== null);
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity]);
}

function firstNonEmptyLine(texts: string[]): string {
  const lines = texts.flatMap((text) => text.split('\n')).map((line) => line.trim());
  return lines.find((line) => line.length > 0) ?? '';
}

export function plainCardText(text: string): string {
  const blocks = editorJsBlocks(text);
  return blocks ? blockTexts(blocks).join(' ').replace(/<[^>]+>/g, '') : text;
}

export function firstLineOfCardText(text: string): string {
  const blocks = editorJsBlocks(text);
  return blocks ? firstNonEmptyLine(blockTexts(blocks).map(htmlToText)) : firstNonEmptyLine([text]);
}
