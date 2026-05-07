const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

router.post('/', (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).send('Unauthorized');
  }

  const body = JSON.parse(req.body.toString());
  // Webhookイベントは非同期で処理し、LINEには即200を返す
  res.sendStatus(200);

  handleEvents(body.events).catch(console.error);
});

async function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'follow') {
      // 友だち追加時：リッチメニューは管理画面から設定するため、ウェルカムメッセージのみ送信
      await sendWelcome(event.source.userId);
    }
  }
}

async function sendWelcome(userId) {
  const { default: fetch } = await import('node-fetch');
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: 'text',
          text: '上野自動車学校 ライセンスジョブへようこそ！\n\nメニューから求人を探したり、マイページで応募状況を確認できます。',
        },
      ],
    }),
  });
}

module.exports = router;
