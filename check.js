// MastoPin -Your Mastondon public updates saved to Pinboard
// TODO: Add your favourites too
// Copyright Conor O'Neill 2017, conor@conoroneill.com
// LICENSE Apache-2.0
// Using Serverless on AWS Lambda

"use strict";

const AWS = require("aws-sdk"); // eslint-disable-line import/no-extraneous-dependencies
var FeedParser = require("feedparser");
var request = require("request"); // for fetching the Mastodon feed and posting to Pinboard
var throttledRequest = require("throttled-request")(request);
var qs = require("querystring");
var htmlToText = require("html-to-text");
var he = require("he");

throttledRequest.configure({
  requests: 5,
  milliseconds: 1000
}); //This will throttle the requests so no more than 5 are made every second

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.check = (event, context, callback) => {
  var prevTime;
  var currTime = new Date().getTime();

  console.log("MastoPin ran on ", new Date().toUTCString());

  const setParams = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      id: "1",
      updatedAt: currTime
    }
  };

  const getParams = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: "1"
    }
  };

  dynamoDb.get(getParams, (error, result) => {
    // See if this is first time run. If so, don't process, just save timestamp for next run
    if (error || result.Item == null) {
      console.error(
        "Probably not an error, just first time run for DynamoDB",
        error
      );
    } else {
      // extract prev run time from DB
      prevTime = result.Item.updatedAt;

      var apikey = process.env.MASTOPIN_PINBOARD_APIKEY || "";
      var profileurl = process.env.MASTOPIN_MASTODON_URL || "";

      // Need to convert that profile URL into an ATOM URL
      // So from https://mastodon.social/@conoro to https://mastodon.social/users/conoro.atom
      // Optional trailing slash on profile URL
      var parsedUrl = require("url").parse(profileurl);
      var username;
      if (parsedUrl.pathname.substr(-1) == "/") {
        username = parsedUrl.pathname.substr(2, parsedUrl.pathname.length - 3);
      } else {
        username = parsedUrl.pathname.substr(2);
      }
      var rssURL =
        parsedUrl.protocol +
        "//" +
        parsedUrl.host +
        "/users/" +
        username +
        ".atom";

      var req = request(rssURL);
      var feedparser = new FeedParser();

      req.on("error", function(error) {
        // handle any request errors
        console.log(error);
        callback(null, {
          statusCode: error.statusCode || 501,
          headers: { "Content-Type": "text/plain" },
          body: "Error requesting data from Mastodon"
        });
        return;
      });

      req.on("response", function(res) {
        var stream = this; // `this` is `req`, which is a stream

        if (res.statusCode !== 200) {
          console.log("Error requesting data from Mastodon");
          callback(null, {
            statusCode: 501,
            headers: { "Content-Type": "text/plain" },
            body: "Error requesting data from Mastodon"
          });
          return;
        } else {
          stream.pipe(feedparser);
        }
      });

      feedparser.on("error", function(error) {
        console.log(error);
        callback(null, {
          statusCode: error.statusCode || 501,
          headers: { "Content-Type": "text/plain" },
          body: "Error parsing feed data from Mastodon"
        });
        return;
      });

      feedparser.on("readable", function() {
        var stream = this;
        var meta = this.meta;
        var item;
        var incomingItem;

        var lastPostTime = new Date(prevTime);

        while ((incomingItem = stream.read())) {
          /* Post each Mastodon update to Pinboard if it's newer than the last run time */
          var postTime = new Date(incomingItem.date);

          if (postTime > lastPostTime) {
            var postTitle = incomingItem.title;

            // Unescape the horrible HTML in Mastodon content and then strip it all out
            // ,{hideLinkHrefIfSameAsText: true} option doesn't work very well. Breaks long URLs on Pinboard
            // So I'll just have to put up with repeated markdown-style URLs
            var postDescription = htmlToText.fromString(
              he.decode(incomingItem.description)
            );

            var postURL = incomingItem.link;
            var pinboardURL =
              "https://api.pinboard.in/v1/posts/add?auth_token=" +
              apikey +
              "&url=" +
              qs.escape(postURL) +
              "&description=" +
              qs.escape(postTitle) +
              "&extended=" +
              qs.escape(postDescription) +
              "&tags=mastodon,mastopin";

            // Use throttledRequest so we aren't hitting Pinboard too hard if lots of Mastodon updates
            throttledRequest(pinboardURL, function(error, response, body) {
              if (error) {
                console.log("error posting to Pinboard:", error);
                callback(null, {
                  statusCode: error.statusCode || 501,
                  headers: { "Content-Type": "text/plain" },
                  body: "error posting to Pinboard"
                });
                return;
              }
              console.log(
                "pinBoard statusCode:",
                response && response.statusCode
              );
              console.log("pinBoard body:", body);
            });
          }
        }
      });

      feedparser.on("end", function() {
        // Success back to Lambda?
      });
    }
    dynamoDb.put(setParams, error => {
      // handle potential errors
      if (error) {
        console.error(error);
        callback(null, {
          statusCode: error.statusCode || 501,
          headers: { "Content-Type": "text/plain" },
          body: "Couldn't save timestamp in DB"
        });
        return;
      } else {
        // create a response
        const response = {
          statusCode: 200,
          body: "Checked Mastodon OK"
        };
        callback(null, response);
      }
    });
  });
};
