import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Katex from 'react-native-katex';
import type { WebViewMessageEvent } from 'react-native-webview';

const MIN_BLOCK_HEIGHT = 64;
const MAX_SCREEN_HEIGHT_RATIO = 0.5;
const HEIGHT_MESSAGE_PREFIX = 'math-height:';
const platformScrollProps =
  Platform.OS === 'android' ? { nestedScrollEnabled: true } : {};

const addMobileViewportScript = `
(function () {
  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1';
})();
true;
`;

const measureMathHeightScript = `
(function () {
  var lastHeight = 0;

  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1';

  function reportHeight() {
    var display = document.querySelector('.katex-display');
    var nextHeight = Math.ceil(Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      display ? display.scrollHeight : 0
    ));

    if (
      nextHeight > 0 &&
      nextHeight !== lastHeight &&
      window.ReactNativeWebView
    ) {
      lastHeight = nextHeight;
      window.ReactNativeWebView.postMessage('${HEIGHT_MESSAGE_PREFIX}' + nextHeight);
    }
  }

  window.requestAnimationFrame(reportHeight);
  window.setTimeout(reportHeight, 50);

  if (window.ResizeObserver) {
    new ResizeObserver(reportHeight).observe(document.body);
  }
})();
true;
`;

const getBlockHtmlStyle = (color: string, fontSize: number): string => `
html,
body {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  color: ${color};
}

html {
  overflow: hidden;
}

body {
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.katex-display {
  box-sizing: border-box;
  width: max-content;
  min-width: 100%;
  margin: 0;
  padding: 10px 12px;
  text-align: center;
}

.katex {
  color: ${color};
  font-size: ${fontSize}px;
}
`;

type MarkdownMathBlockProps = {
  color: string;
  expression: string;
  fontSize: number;
};

function MarkdownMathBlock({
  color,
  expression,
  fontSize,
}: MarkdownMathBlockProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [measuredContentHeight, setMeasuredContentHeight] =
    useState(MIN_BLOCK_HEIGHT);
  const maximumHeight = Math.max(
    MIN_BLOCK_HEIGHT,
    Math.round(screenHeight * MAX_SCREEN_HEIGHT_RATIO),
  );
  const contentHeight = Math.min(
    maximumHeight,
    Math.max(MIN_BLOCK_HEIGHT, measuredContentHeight),
  );
  const htmlStyle = useMemo(
    () => getBlockHtmlStyle(color, fontSize),
    [color, fontSize],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { data } = event.nativeEvent;
      if (!data.startsWith(HEIGHT_MESSAGE_PREFIX)) return;

      const nextMeasuredHeight = Number(
        data.slice(HEIGHT_MESSAGE_PREFIX.length),
      );
      if (!Number.isFinite(nextMeasuredHeight)) return;

      const nextHeight = Math.ceil(nextMeasuredHeight);
      setMeasuredContentHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    },
    [],
  );

  return (
    <Katex
      expression={expression.trim()}
      displayMode
      inlineStyle={htmlStyle}
      injectedJavaScriptBeforeContentLoaded={addMobileViewportScript}
      injectedJavaScript={measureMathHeightScript}
      onMessage={handleMessage}
      {...platformScrollProps}
      showsHorizontalScrollIndicator
      showsVerticalScrollIndicator={false}
      containerStyle={styles.webViewContainer}
      style={[styles.webView, { height: contentHeight }]}
    />
  );
}

export default React.memo(MarkdownMathBlock);

const styles = StyleSheet.create({
  webViewContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  webView: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
});
