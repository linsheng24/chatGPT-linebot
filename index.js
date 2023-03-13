const line = require("@line/bot-sdk");
const express = require("express");
const axios = require("axios");
const Redis = require("ioredis");
require("dotenv").config();

const { REDIS_URL } = process.env;
const renderRedis = new Redis(REDIS_URL);

async function getChatReply(logs = []) {
  let data = JSON.stringify({
    model: "gpt-3.5-turbo",
    max_tokens: 300,
    messages: [
      ...logs,
    ],  
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
  const message = event.message.text;
  const userId = event?.source?.userId;
  let reply;
  if (message === '小寶貝早安！') {
    reply = { type: 'text', text: '早安～～' };
  } else if (message === '喝下孟婆湯吧！') {
    reply = { type: 'text', text: '咕嚕咕嚕～～ 好喝' };
    await renderRedis.del(`log_${userId}`)
  } else {
    try {
      const userLog = { role: "user", content: message };
      const userLogs = await renderRedis.get(`log_${userId}`);
      let newLogs = !userLogs ? [userLog] : [...(JSON.parse(userLogs)).slice(-6), userLog];
      await renderRedis.set(`log_${userId}`, JSON.stringify(newLogs));
      reply = await getChatReply(newLogs);
      await renderRedis.set(`log_${userId}`, JSON.stringify([
        ...newLogs,
        { role: "assistant", content: reply.text }
      ]));
    } catch (e) {
      reply = { type: 'text', text: '我是小寶貝，我吃好飽，我想睡覺～～～zzZ' };
    }
  }
  return client.replyMessage(event.replyToken, reply);
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
