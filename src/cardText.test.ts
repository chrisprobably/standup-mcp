import { describe, it, expect } from 'vitest';
import { firstLineOfCardText, plainCardText } from './cardText.js';

const editorJs = (...blocks: unknown[]) => JSON.stringify({ time: 1, blocks });
const paragraph = (text: unknown) => ({ type: 'paragraph', data: { text } });

describe('firstLineOfCardText', () => {
  it('treats malformed JSON as plain text', () => {
    expect(firstLineOfCardText('{"blocks": [oops')).toBe('{"blocks": [oops');
  });

  it('skips blocks whose text is not a string', () => {
    expect(firstLineOfCardText(editorJs(paragraph(5), paragraph('Real title')))).toBe('Real title');
  });

  it('gives an empty first line when no block has text', () => {
    expect(firstLineOfCardText(editorJs(paragraph(5), { type: 'delimiter', data: {} }))).toBe('');
  });

  it('skips null blocks instead of falling back to the raw JSON', () => {
    expect(firstLineOfCardText(editorJs(null, paragraph('Real title')))).toBe('Real title');
  });

  it('keeps angle brackets in plain text', () => {
    expect(firstLineOfCardText('use <T> in a < b > c')).toBe('use <T> in a < b > c');
  });

  it('keeps HTML entities in plain text', () => {
    expect(firstLineOfCardText('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
  });

  it('gives an empty first line for whitespace-only text', () => {
    expect(firstLineOfCardText('  \n\t \n ')).toBe('');
  });

  it('takes the first item of a list block', () => {
    const list = { type: 'list', data: { style: 'unordered', items: ['<i>Buy</i> milk', 'Buy eggs'] } };

    expect(firstLineOfCardText(editorJs(list))).toBe('Buy milk');
  });

  it('takes the first item of a nested list block', () => {
    const list = { type: 'list', data: { style: 'ordered', items: [{ content: 'Step one', items: [] }] } };

    expect(firstLineOfCardText(editorJs(list))).toBe('Step one');
  });

  it('takes the first item of a checklist block', () => {
    const checklist = { type: 'checklist', data: { items: [{ text: 'Write tests', checked: false }, { text: 'Ship' }] } };

    expect(firstLineOfCardText(editorJs(checklist, paragraph('Later')))).toBe('Write tests');
  });
});

describe('plainCardText', () => {
  it('skips null blocks instead of falling back to the raw JSON', () => {
    expect(plainCardText(editorJs(null, paragraph('Bump the version')))).toBe('Bump the version');
  });

  it('skips blocks whose text is not a string', () => {
    expect(plainCardText(editorJs(paragraph(5), paragraph('Bump the version')))).toBe('Bump the version');
  });

  it('includes the first item of a list block', () => {
    const list = { type: 'list', data: { style: 'unordered', items: ['Bump <b>the</b> version', 'Tag it'] } };

    expect(plainCardText(editorJs(paragraph('Release:'), list))).toBe('Release: Bump the version');
  });
});
