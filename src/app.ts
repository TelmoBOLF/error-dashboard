import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  ResultField,
} from "@aws-sdk/client-cloudwatch-logs";
import { writeToFile } from "./logsProcess";

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


// Define types for parameter configuration
interface CloudWatchQueryConfig {
  logGroupName: string;
  queryString: string;
  startTime?: number; // Optional, defaults to 1 hour ago
  endTime?: number; // Optional, defaults to now
}

async function fetchLogsFromCloudwatch(
  configs: CloudWatchQueryConfig | CloudWatchQueryConfig[]
): Promise<
  {
    logGroupName: string;
    results: ResultField[][];
  }[]
> {
  const client = new CloudWatchLogsClient({ region: "eu-central-1" });
  // Convert single config to array for uniform processing
  const queryConfigs = Array.isArray(configs) ? configs : [configs];

  // Start all queries concurrently
  const queryPromises = queryConfigs.map(async (config) => {
    const { logGroupName, queryString, startTime, endTime } = config;

    // const defaultStartTime = Math.floor((Date.now() - 60 * 60 * 1000) / 1000); // 1 hour ago
    const defaultStartTime = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // 10 minutes ago
    const defaultEndTime = Math.floor(Date.now() / 1000); // now

    const startQueryCommand = new StartQueryCommand({
      logGroupNames: [logGroupName],
      startTime: startTime || defaultStartTime,
      endTime: endTime || defaultEndTime,
      queryString,
    });

    try {
      const { queryId } = await client.send(startQueryCommand);

      if (!queryId) {
        console.error(`Failed to start query for log group: ${logGroupName}`);
        return { logGroupName, results: [] };
      }

      return { logGroupName, queryId };
    } catch (error) {
      console.error(
        `Error starting query for log group ${logGroupName}:`,
        error
      );
      return { logGroupName, results: [] };
    }
  });

  const queryData = await Promise.all(queryPromises);

  // Poll for results
  const resultPromises = queryData.map(async (data) => {
    if (!("queryId" in data)) {
      return data; // Return early if we already have results (empty)
    }

    const { logGroupName, queryId } = data;
    let queryStatus: string | undefined = "Running";
    let results: ResultField[][] = [];

    do {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2 sec

      try {
        const getQueryResultsCommand = new GetQueryResultsCommand({ queryId });
        const response = await client.send(getQueryResultsCommand);
        queryStatus = response.status;

        if (response.results && response.results.length > 0) {
          results = response.results;
        }
      } catch (error) {
        console.error(
          `Error getting results for query ${queryId} (${logGroupName}):`,
          error
        );
        queryStatus = "Failed";
      }
    } while (queryStatus === "Running" || queryStatus === "Scheduled");

    return { logGroupName, results };
  });

  return Promise.all(resultPromises);
}

interface LogGroupResults {
  logGroupName: string;
  results: ResultField[][];
}

function prepareDataForOverview(logGroupResultsArray: LogGroupResults[]): Record<string, Record<string, Array<TOffer>>> {
  const logsWithoutOffer: Record<string, Record<string, any[]>> = {};

  const allQueryResults: Record<string, Record<string, Array<TOffer>>> = {};
  // Process each log group's results
  logGroupResultsArray.forEach(({ logGroupName, results }) => {
    // Initialize results for this log group if not exists
    if (!allQueryResults[logGroupName]) {
      allQueryResults[logGroupName] = {};
    }
    results.forEach((row) => {
      const messageCol = row.find((col) => col.field === "@message");
      if (messageCol && messageCol.value) {
        try {
          const parsedMessage = JSON.parse(messageCol.value);
          // 1. Transform data to the following format: TIMESTAMP | MCRNUMBER | CONTACT EMAIL | ERROR MESSAGE
          const timestamp = parsedMessage.time
            ? new Date(parsedMessage.time).toISOString()
            : parsedMessage.timestamp;

          // Initialize array for this timestamp if not exists
          if (!allQueryResults[logGroupName][timestamp]) {
            allQueryResults[logGroupName][timestamp] = [];
          }

          // Proces different message formats
          if (parsedMessage?.message?.offers) {
            // Lambda function format
            parsedMessage.message.offers.map((offer: TOfferDecoded) => {
              allQueryResults[logGroupName][timestamp].push({
                MRCNumber: offer.MRCNumber,
                contactEmail: offer.contactEmail,
                errorMessage: `Split Percentage or Available Volume is not valid`,
                splitPercentage: offer.SplitPercentage,
                availableVolume: offer.availableVolume,
              });
            });
          } else if (parsedMessage.offer) {
            // Single offer format
            const offer: TOfferDecoded = parsedMessage.offer;
            allQueryResults[logGroupName][timestamp].push({
              MRCNumber: offer.MRCNumber,
              contactEmail: offer.contactEmail,
              errorMessage: parsedMessage.msg,
              splitPercentage: offer.SplitPercentage,
              availableVolume: offer.availableVolume,
            });
          } else if (parsedMessage.offerDecoded) {
            // Decoded offer format
            const offer: TOfferDecoded = parsedMessage.offerDecoded;
            allQueryResults[logGroupName][timestamp].push({
              MRCNumber: offer.MRCNumber,
              contactEmail: offer.contactEmail,
              errorMessage: parsedMessage.msg,
              splitPercentage: offer.SplitPercentage,
              availableVolume: offer.availableVolume,
            });
          } else if (parsedMessage.offers) {
            // Multiple offers format
            parsedMessage.offers.map((offer: TOfferDecoded) => {
              allQueryResults[logGroupName][timestamp].push({
                MRCNumber: offer.MRCNumber,
                contactEmail: offer.contactEmail,
                errorMessage: parsedMessage.msg,
                splitPercentage: offer.SplitPercentage,
                availableVolume: offer.availableVolume,
              });
            });
          } else {
            // Handle case where no offer is present
            if (!logsWithoutOffer[logGroupName]) {
              logsWithoutOffer[logGroupName] = {};
            }
            if (!logsWithoutOffer[logGroupName][timestamp]) {
              logsWithoutOffer[logGroupName][timestamp] = [parsedMessage];
            } else {
              logsWithoutOffer[logGroupName][timestamp].push(parsedMessage);
            }
          }
        } catch (e) {
          console.error("Something went wrong: ", {
            logGroupName,
            e,
            message: messageCol.value,
          });
        }
      }
    });


  });
  return allQueryResults;
}

async function processCloudwatchErrorLogs() {
  // Multiple queries to different log groups
  const logGroupResults = await fetchLogsFromCloudwatch([
    {
      logGroupName:
        "/aws/lambda/shell-integration-service-staging-importOffers",
      queryString: `
      fields @timestamp, @message
      | filter level = "WARN"
      | filterIndex message.flag = "SHELL-IMPORT-OFFERS"
      | sort @timestamp desc
      | limit 1000
    `,
    },
    {
      logGroupName: "/olf/ecs/logs",
      queryString: `
      fields @timestamp, @message
      | filterIndex flag = "SHELL-IMPORT-OFFERS"
      | sort @timestamp desc
      | limit 10000
    `,
    },
  ]);

  // Process the results
const organizedByLogGroup = prepareDataForOverview(logGroupResults);
Object.keys(organizedByLogGroup).forEach((logGroupName) => {
  writeToFile(organizedByLogGroup[logGroupName],logGroupName);

});
return organizedByLogGroup;
}

(async () => {
  const result = await processCloudwatchErrorLogs();
  console.log("Result: ", result);
}
)();
