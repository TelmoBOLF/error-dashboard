import express, { Request, Response } from 'express';
import { createApp, renderAppToHtml } from './app'
import path from 'path';
const app = express();
const port = 3000;

app.use(express.static('.'));
app.get('/', async (req, res) => {
  // const data = await Services.processCloudwatchErrorLogs();
  // Send the HTML file as the response
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/app', async (req: Request, res: Response) => {
  const vueApp = createApp();
  const renderedHtml = await renderAppToHtml(vueApp);

  res.send(renderedHtml);
});

// Alternatively, you can specifically serve just the client.js file
// Method 1: Direct route to the specific file
app.get('/client.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.js'));
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
