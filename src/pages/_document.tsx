import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/basketball-favicon.png" />
        <link rel="shortcut icon" href="/basketball-favicon.png" />
        <link rel="apple-touch-icon" href="/basketball-favicon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/basketball-favicon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/basketball-favicon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
