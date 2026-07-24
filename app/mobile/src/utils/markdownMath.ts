type MarkdownToken = {
  block: boolean;
  content: string;
  map?: [number, number];
  markup: string;
};

type MarkdownBlockState = {
  bMarks: number[];
  eMarks: number[];
  line: number;
  push: (type: string, tag: string, nesting: number) => MarkdownToken;
  src: string;
  tShift: number[];
};

type MarkdownInlineState = {
  pos: number;
  posMax: number;
  push: (type: string, tag: string, nesting: number) => MarkdownToken;
  src: string;
};

type BlockRule = (
  state: MarkdownBlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
) => boolean;

type InlineRule = (state: MarkdownInlineState, silent: boolean) => boolean;

type MarkdownItWithRulers = {
  block: {
    ruler: {
      before: (
        beforeName: string,
        ruleName: string,
        rule: BlockRule,
        options: { alt: string[] },
      ) => void;
    };
  };
  inline: {
    ruler: {
      before: (
        beforeName: string,
        ruleName: string,
        rule: InlineRule,
      ) => void;
    };
  };
};

const getLine = (state: MarkdownBlockState, line: number): string => {
  const start = state.bMarks[line] + state.tShift[line];
  return state.src.slice(start, state.eMarks[line]);
};

const bracketMathBlock: BlockRule = (
  state,
  startLine,
  endLine,
  silent,
) => {
  const firstLine = getLine(state, startLine);
  if (!firstLine.startsWith('\\[')) return false;

  const contentLines: string[] = [];
  const firstContent = firstLine.slice(2);
  const singleLineClosingIndex = firstContent.lastIndexOf('\\]');
  const hasSingleLineClosingDelimiter =
    singleLineClosingIndex >= 0 &&
    firstContent.slice(singleLineClosingIndex + 2).trim() === '';

  if (silent) {
    if (hasSingleLineClosingDelimiter) return true;

    for (let line = startLine + 1; line < endLine; line += 1) {
      const lineContent = getLine(state, line);
      const closingIndex = lineContent.lastIndexOf('\\]');
      if (
        closingIndex >= 0 &&
        lineContent.slice(closingIndex + 2).trim() === ''
      ) {
        return true;
      }
    }

    return false;
  }

  if (hasSingleLineClosingDelimiter) {
    contentLines.push(firstContent.slice(0, singleLineClosingIndex));
    state.line = startLine + 1;
  } else {
    contentLines.push(firstContent);
    let closingLine = startLine + 1;
    let foundClosingDelimiter = false;

    for (; closingLine < endLine; closingLine += 1) {
      const lineContent = getLine(state, closingLine);
      const closingIndex = lineContent.lastIndexOf('\\]');

      if (
        closingIndex >= 0 &&
        lineContent.slice(closingIndex + 2).trim() === ''
      ) {
        contentLines.push(lineContent.slice(0, closingIndex));
        foundClosingDelimiter = true;
        break;
      }

      contentLines.push(lineContent);
    }

    if (!foundClosingDelimiter) return false;
    state.line = closingLine + 1;
  }

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = contentLines.join('\n').trim();
  token.map = [startLine, state.line];
  token.markup = '\\[\\]';
  return true;
};

const bracketMathInline: InlineRule = (state, silent) => {
  if (
    state.pos + 4 > state.posMax ||
    state.src.slice(state.pos, state.pos + 2) !== '\\('
  ) {
    return false;
  }

  const closingIndex = state.src.indexOf('\\)', state.pos + 2);
  if (closingIndex <= state.pos + 2) return false;

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.block = false;
    token.content = state.src.slice(state.pos + 2, closingIndex);
    token.markup = '\\(\\)';
  }

  state.pos = closingIndex + 2;
  return true;
};

export const markdownItBracketMath = (
  markdownIt: MarkdownItWithRulers,
): void => {
  markdownIt.block.ruler.before(
    'paragraph',
    'bracket_math_block',
    bracketMathBlock,
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list'],
    },
  );
  markdownIt.inline.ruler.before(
    'escape',
    'bracket_math_inline',
    bracketMathInline,
  );
};
