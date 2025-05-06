// this runs in Node.js on the server.
import { App, createSSRApp, h } from "vue";
// Vue's server-rendering API is exposed under `vue/server-renderer`.
import { renderToString } from "vue/server-renderer";

function createApp() {
  const app = createSSRApp({
    data: () => ({ count: 1 }),
    template: `<button @click="count++">{{ count }}</button>`,
  });

  return app;
}

function renderAppToHtml(app:  App<Element>) {
  const renderedHtml = renderToString(app).then((html) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vue SSR Example</title>
        <script type="importmap">
          {
            "imports": {
              "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
            }
          }
        </script>
        <script type="module" src="/client.js"></script>
      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
    `;
  });
  return renderedHtml;
}

export { createApp, renderAppToHtml };
