import express, { Request, Response } from 'express';
import * as Services from './services'
import path from 'path';
const app = express();
const port = 3000;

app.get('/', async (req, res) => {
  // const data = await Services.processCloudwatchErrorLogs();
  // Send the HTML file as the response
  console.log('dirname: ', __dirname);
  console.log('path: ', path.join(__dirname, 'index.html'));
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/app', async (req: Request, res: Response) => {
  const vueApp = await Services.app.createApp();
  
  res.send(vueApp);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
