import express, { Request, Response } from 'express';
import * as Services from '.'
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
  const vueApp = Services.app.createApp();
  const renderedHtml = await Services.app.renderAppToHtml(vueApp);

  res.send(renderedHtml);
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
