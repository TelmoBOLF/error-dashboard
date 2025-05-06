"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudwatch_logs_1 = require("@aws-sdk/client-cloudwatch-logs");
const fs_1 = __importDefault(require("fs"));
function fetchLogsFromCloudwatch() {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new client_cloudwatch_logs_1.CloudWatchLogsClient({ region: "eu-central-1" });
        // const logGroupName = "/olf/ecs/logs";
        const logGroupName = "/aws/lambda/shell-integration-service-staging-importOffers";
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
        const startQueryCommand = new client_cloudwatch_logs_1.StartQueryCommand({
            logGroupNames: [logGroupName],
            startTime: Math.floor((Date.now() - 60 * 60 * 1000) / 1000), // 1 hour ago
            endTime: Math.floor(Date.now() / 1000),
            queryString,
        });
        const { queryId } = yield client.send(startQueryCommand);
        if (!queryId) {
            console.error("Failed to start query.");
            return [];
        }
        // Poll for results
        let queryStatus = "Running";
        let results;
        do {
            yield new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2 sec
            const getQueryResultsCommand = new client_cloudwatch_logs_1.GetQueryResultsCommand({ queryId });
            const response = yield client.send(getQueryResultsCommand);
            queryStatus = response.status;
            results = response.results;
        } while (queryStatus === "Running" || queryStatus === "Scheduled");
        if (!results || (results === null || results === void 0 ? void 0 : results.length) == 0) {
            console.log("No results found.");
            return [];
        }
        return results;
    });
}
function prepareDataForOverview(results) {
    const queryResults = {};
    results.forEach((row) => {
        const messageCol = row.find((col) => col.field === "@message");
        if (messageCol && messageCol.value) {
            try {
                const parsedMessage = JSON.parse(messageCol.value);
                // 1. Transform data to the following format: TIMESTAMP | MCRNUMBER | CONTACT EMAIL | ERROR MESSAGE
                const timestamp = new Date(parsedMessage.time).toISOString();
                // const timestamp = parsedMessage.timestamp;
                if (!Object.keys(queryResults).includes(timestamp)) {
                    queryResults[timestamp] = [];
                }
                if (parsedMessage === null || parsedMessage === void 0 ? void 0 : parsedMessage.offers) {
                    parsedMessage.message.offers.map((offer) => {
                        queryResults[timestamp].push({
                            mrcNumber: offer.MRCNumber,
                            contactEmail: offer.contactEmail,
                            errorMessage: `Split Percentage or Available Volume is not valid`,
                            splitPercentage: offer.SplitPercentage,
                            availableVolume: offer.availableVolume,
                        });
                    });
                }
                else if (parsedMessage.offer) {
                    const offer = parsedMessage.offer;
                    queryResults[timestamp].push({
                        mrcNumber: offer.MRCNumber,
                        contactEmail: offer.contactEmail,
                        errorMessage: parsedMessage.msg,
                        splitPercentage: offer.SplitPercentage,
                        availableVolume: offer.availableVolume,
                    });
                }
                // else if (parsedMessage.offer) {
                //  parsedMessage.message.offers.map((offer: any) => {
                //   const offer = parsedMessage.offer;
                //   queryResults[timestamp].push({
                //     mrcNumber: offer.MRCNumber,
                //     contactEmail: offer.contactEmail,
                //     errorMessage: 'Split Percentage or Available Volume is not valid',
                //     splitPercentage: offer.SplitPercentage,
                //     availableVolume: offer.availableVolume,
                //   });
                // }
                else if (parsedMessage.offerDecoded) {
                    const offer = parsedMessage.offerDecoded;
                    queryResults[timestamp].push({
                        mrcNumber: offer.MRCNumber,
                        contactEmail: offer.contactEmail,
                        errorMessage: parsedMessage.msg,
                        splitPercentage: offer.SplitPercentage,
                        availableVolume: offer.availableVolume,
                    });
                }
            }
            catch (e) {
                console.error("Something went wrong: ", {
                    e,
                    message: messageCol.value,
                });
            }
        }
    });
    return queryResults;
}
function writeToFile(data) {
    const filePath = "./lambda-function-import-offers-for-shell-verbose.json";
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`Query results saved to ${filePath}`);
}
function loadDataFromFile() {
    try {
        // Read the content of both files
        const lambdaImportOffersContent = fs_1.default.readFileSync('lambda-function-import-offers-for-shell-verbose.json', 'utf8');
        const offersServiceCreateOffersContent = fs_1.default.readFileSync('offers-service-create-offers-for-shell-verbose.json', 'utf8');
        // Parse the JSON content
        const lambdaImportOffers = JSON.parse(lambdaImportOffersContent);
        // const offersServiceCreateOffers = JSON.parse(offersServiceCreateOffersContent);
        // Return both parsed objects
        return lambdaImportOffers;
    }
    catch (error) {
        console.error('Error reading or parsing the JSON files:', error);
        throw error;
    }
}
function runLogsInsightsQuery() {
    return __awaiter(this, void 0, void 0, function* () {
        // const logs = await fetchLogsFromCloudwatch();
        const logs = loadDataFromFile();
        if (logs.length === 0) {
            return;
        }
        // prepare the imported logs
        const dataForOverview = prepareDataForOverview(logs);
        //save to a file
        // writeToFile(dataForOverview);
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield runLogsInsightsQuery();
    }
    catch (error) {
        console.error("Error running query:", error);
    }
}))();
