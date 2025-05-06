import express, { Request, Response } from 'express';
import * as Services from './services'
const app = express();
const port = 3000;

app.get('/', async (req: Request, res: Response) => {
  const data = await Services.processCloudwatchErrorLogs();
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
