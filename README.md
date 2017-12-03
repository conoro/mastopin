# MastoPin

A Serverless AWS Lambda function that runs every 15 minutes, checks your
Mastodon public updates and saves them to Pinboard

## Setup

(Assuming you have your AWS access credentials already setup)

1. Get your Pinboard API Token [here](https://pinboard.in/settings/password)
2. Then:

```bash
git clone git@github.com:conoro/mastopin.git
cd mastopin
```

3. Rename mastopin-sample.env.yml to mastopin.env.yml
4. Edit mastopin.env.yml and save the value from step 1 and enter your Mastodon
   profile URL
5. Then:

```
npm install -g serverless
npm install
serverless deploy
```

Notes:

1. You can check Cron logs with

```bash
serverless logs -f cron
```

2. If you make minor changes to just the function code, you can do a quick
   re-deploy with:

```bash
serverless deploy function -f check
```

LICENSE Apache-2.0

Copyright Conor O'Neill 2017, conor@conoroneill.com
