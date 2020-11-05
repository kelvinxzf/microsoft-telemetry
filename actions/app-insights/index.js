const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const eventsSdk = require('@adobe/aio-lib-events')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const appInsights = require('applicationinsights');

// create a Logger
const logger = Core.Logger('main', { level: 'info' })

// main function that will be executed by Adobe I/O Runtime
async function main(params) {

  var returnObject = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: ""
  };

  try {
    // 'info' is the default level if not set
    logger.info('Inside main app insights function')
    logger.info(stringParameters(params))

    if (params.challenge) {
      logger.info('Returning challenge: ' + params.challenge);

      returnObject.body = new Buffer(JSON.stringify({
        "challenge": params.challenge
      })).toString('base64');

      return returnObject;

    } else {
      logger.info('Handling the app insights ingestion now')

      if (Object.keys(params).length > 0) {
        if (verifyAdobeSignature(params)) {
          const event = params.event;
          logger.info(JSON.stringify(event));

          appInsights.setup(params.iKey).start();
          var client = appInsights.defaultClient;
          client.addTelemetryProcessor(envelope => {
            envelope.tags["ai.cloud.role"] = "microsoft-telemetry";
            envelope.tags["ai.cloud.roleInstance"] = "microsoft-telemetry"
          });

          client.trackEvent({ name: "Microsoft.events.AdobeEvent", properties: { IOEventBody: JSON.stringify(event) } });
        }
        else {
          logger.error("x-adobe-signature header verification failure")
        }
      }
      return returnObject;
    }

  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }

  async function verifyAdobeSignature(params) {
    if (params.__ow_headers &&
      params.__ow_headers["x-adobe-signature"] &&
      params.event) {
      logger.info("x-adobe-signature:" + params.__ow_headers["x-adobe-signature"]);
      const client = await eventsSdk.init(params.orgId, params.apiKey, params.authToken)
      return client.verifySignatureForEvent(params.event, params.clientSecret, params.__ow_headers["x-adobe-signature"]);
    }
    return false;
  }
}

exports.main = main
