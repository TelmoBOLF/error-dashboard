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
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudwatch_logs_1 = require("@aws-sdk/client-cloudwatch-logs");
const client = new client_cloudwatch_logs_1.CloudWatchLogsClient({ region: "eu-central-1" });
function fetchLogsByString(logGroupName, searchString) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const params = {
                logGroupName,
                filterPattern: searchString,
                startTime: Date.now() - 60 * 60 * 1000, // Start time in milliseconds (1 hour ago)
                endTime: Date.now(), // End time in milliseconds (now)
                limit: 100, // Limit the number of log events returned
                interleaved: true, // Set to true to get log events in the order they were ingested
            };
            const command = new client_cloudwatch_logs_1.FilterLogEventsCommand(params);
            const response = yield client.send(command);
            if (!response.events || response.events.length === 0) {
                console.log("No log events found.");
                return [];
            }
            // Log the response
            console.log("Fetched log events:");
            response.events.forEach((event) => {
                console.log('**************');
                const timestamp = (event === null || event === void 0 ? void 0 : event.timestamp) ? new Date(event.timestamp).toISOString() : 'N/A';
                console.log(`[${timestamp}] ${event.message}`);
                console.log(event);
                console.log('**************');
            });
            // Optionally return all events
            return response.events;
        }
        catch (err) {
            console.error("Error fetching logs:", err);
        }
    });
}
// Introduce flags and indexes
// Example usage:
// const logGroupName = "/aws/lambda/shell-integration-service-staging-importOffers";
// const searchString = "Offers Valid for";  // Example: look for "ERROR" messages
const logGroupName = "/olf/ecs/logs";
const searchString = "";
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fetchLogsByString(logGroupName, searchString);
    }
    catch (error) {
        console.error("Error in fetching logs:", error);
    }
}))();
