const express = require('express');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();
  Promise.all(req.body.events.map(handleEvent)).catch(console.error);
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const songName = event.message.text.trim();
  const files = await searchDriveFiles(songName);

  if (files.length === 0) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `找不到「${songName}」的歌譜，請確認歌曲名稱是否正確。`
    });
  }

  const messages = files.map(file => ({
    type: 'image',
    originalContentUrl: `https://drive.google.com/uc?export=view&id=${file.id}`,
    previewImageUrl: `https://drive.google.com/uc?export=view&id=${file.id}`
  }));

  // Line 一次最多傳 5 張
  return client.replyMessage(event.replyToken, messages.slice(0, 5));
}

async function searchDriveFiles(songName) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.FOLDER_ID;

  const response = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${songName}' and trashed = false`,
    fields: 'files(id, name)',
  });

  return response.data.files;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
