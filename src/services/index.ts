import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  ResultField,
} from "@aws-sdk/client-cloudwatch-logs";
import fs from "fs";

type TOffer = {
  MRCNumber: string;
  contactEmail: string;
  splitPercentage: string;
  availableVolume: string;
  errorMessage?: string;
};

type TOfferDecoded = {
  MRCNumber: string;
  contactEmail: string;
  msg: string;
  SplitPercentage: string;
  availableVolume: string;
};

type TIncomingFailedOffers = {
  lambdaOffers: ResultField[][],
  offersServiceOffers: ResultField[][]
}

const logsWithoutOffer: Record = {};

function writeToFile(data: any, file_name?: string) {
  const filePath =
    file_name ?? "./lambda-function-import-offers-for-shell.json";
  // const filePath = file_name ?? "./offers-service-import-offers-for-shell.json";
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Query results saved to ${filePath}`);
}

function loadDataFromFile(): TIncomingFailedOffers {
  try {
    // Read the content of both files
    const lambdaImportOffersContent = fs.readFileSync(
      "lambda-function-import-offers-for-shell-verbose.json",
      "utf8"
    );

    const offersServiceCreateOffersContent = fs.readFileSync(
      "offers-service-create-offers-for-shell-verbose.json",
      "utf8"
    );

    // Parse the JSON content
    const lambdaImportOffers: ResultField[][] = JSON.parse(
      lambdaImportOffersContent
    );
    const offersServiceCreateOffers: ResultField[][] = JSON.parse(
      offersServiceCreateOffersContent
    );

    // Return both parsed objects
    return { lambdaOffers: lambdaImportOffers, offersServiceOffers: offersServiceCreateOffers };
  } catch (error) {
    console.error("Error reading or parsing the JSON files:", error);
    throw error;
  }
}

async function fetchLogsFromCloudwatch(): Promise<ResultField[][]> {
  const client = new CloudWatchLogsClient({ region: "eu-central-1" });
  // const logGroupName = "/olf/ecs/logs";
  const logGroupName =
    "/aws/lambda/shell-integration-service-staging-importOffers";
  const queryString = `
    fields @timestamp, @message
    | filter level = "WARN"
    | filterIndex message.flag = "SHELL-IMPORT-OFFERS"
    | sort @timestamp desc
    | limit 1000
    `;
  // const queryString = `
  // fields @timestamp, @message
  //   | filterIndex flag = "SHELL-IMPORT-OFFERS"
  //   | sort @timestamp desc
  //   | limit 10000
  // `;

  // | filterIndex level in [40,50]
  // | filter @message like "validateMogasBundleOffers"

  const startQueryCommand = new StartQueryCommand({
    logGroupNames: [logGroupName],
    startTime: Math.floor((Date.now() - 60 * 60 * 1000) / 1000), // 1 hour ago
    endTime: Math.floor(Date.now() / 1000),
    queryString,
  });

  const { queryId } = await client.send(startQueryCommand);

  if (!queryId) {
    console.error("Failed to start query.");
    return [];
  }
  // Poll for results
  let queryStatus: string | undefined = "Running";
  let results: ResultField[][] | undefined;

  do {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2 sec

    const getQueryResultsCommand = new GetQueryResultsCommand({ queryId });
    const response = await client.send(getQueryResultsCommand);
    queryStatus = response.status;
    results = response.results;
  } while (queryStatus === "Running" || queryStatus === "Scheduled");

  if (!results || results?.length == 0) {
    console.log("No results found.");
    return [];
  }

  return results;
}

function prepareDataForOverview(results: ResultField[][]) {
  const queryResults: Record<string, Array<TOffer>> = {};
  results.forEach((row) => {
    const messageCol = row.find((col) => col.field === "@message");
    if (messageCol && messageCol.value) {
      try {
        const parsedMessage = JSON.parse(messageCol.value);
        // 1. Transform data to the following format: TIMESTAMP | MCRNUMBER | CONTACT EMAIL | ERROR MESSAGE
        const timestamp = parsedMessage.time
          ? new Date(parsedMessage.time).toISOString()
          : parsedMessage.timestamp;
        if (!Object.keys(queryResults).includes(timestamp)) {
          queryResults[timestamp] = [];
        }
        if (parsedMessage?.message?.offers) {
          //this is the lambda function format
          parsedMessage.message.offers.map((offer: TOfferDecoded) => {
            queryResults[timestamp].push({
              MRCNumber: offer.MRCNumber,
              contactEmail: offer.contactEmail,
              errorMessage: `Split Percentage or Available Volume is not valid`,
              splitPercentage: offer.SplitPercentage,
              availableVolume: offer.availableVolume,
            });
          });
        } else if (parsedMessage.offer) {
          const offer: TOfferDecoded = parsedMessage.offer;
          queryResults[timestamp].push({
            MRCNumber: offer.MRCNumber,
            contactEmail: offer.contactEmail,
            errorMessage: parsedMessage.msg,
            splitPercentage: offer.SplitPercentage,
            availableVolume: offer.availableVolume,
          });
        } else if (parsedMessage.offerDecoded) {
          const offer: TOfferDecoded = parsedMessage.offerDecoded;
          queryResults[timestamp].push({
            MRCNumber: offer.MRCNumber,
            contactEmail: offer.contactEmail,
            errorMessage: parsedMessage.msg,
            splitPercentage: offer.SplitPercentage,
            availableVolume: offer.availableVolume,
          });
        } else if (parsedMessage.offers) {
          parsedMessage.offers.map((offer: TOfferDecoded) => {
            queryResults[timestamp].push({
              MRCNumber: offer.MRCNumber,
              contactEmail: offer.contactEmail,
              errorMessage: parsedMessage.msg,
              splitPercentage: offer.SplitPercentage,
              availableVolume: offer.availableVolume,
            });
          });
        } else {
          if (!Object.keys(logsWithoutOffer).includes(timestamp)) {
            logsWithoutOffer[timestamp] = [parsedMessage];
          } else {
            logsWithoutOffer[timestamp].push(parsedMessage);
          }
        }
      } catch (e) {
        console.error("Something went wrong: ", {
          e,
          message: messageCol.value,
        });
      }
    }
  });
  return queryResults;
}

async function processCloudwatchErrorLogs() {}

export {
  processCloudwatchErrorLogs
}