const line = require("@line/bot-sdk");
const express = require("express");
const axios = require("axios");
require("dotenv").config();

async function getChatReply(text = "") {
  let data = JSON.stringify({
    "model": "gpt-3.5-turbo",
    "messages": [
    { role: "system", content: 'test' },
    { role: "assistant", content: "Hi. How can I help you today?" },
    { role: "user", content: 'test' }],  
  });
    
  var config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    data: data
  };
  let completion = await axios(config)
    .then(function (response) {
      let data = response.data;
      return data
    })
    .catch(function (error) {
      console.log(error, 'error in calling chat completion');
    });

  return { type: "text", text: completion.choices[0].message.content.trim() };
}

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

app.post("/callback", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const echo = await getChatReply(event.message.text);
  return client.replyMessage(event.replyToken, echo);
}
getChatReply('你好');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
