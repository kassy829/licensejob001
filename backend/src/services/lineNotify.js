const line = require('@line/bot-sdk');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// 担当者グループ or 個人IDへ通知
const STAFF_LINE_ID = process.env.STAFF_LINE_USER_ID;

async function notifyStaff(application) {
  if (!STAFF_LINE_ID) return;

  const message = {
    type: 'flex',
    altText: `【新規応募】${application.applicant_name}さんから応募がありました`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '【新規応募】ライセンスジョブ',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
        ],
        backgroundColor: '#1DB446',
        paddingAll: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('氏名', application.applicant_name),
          row('電話番号', application.phone),
          row('求人', application.job_title),
          row('企業', application.company_name),
          row('免許状況', licenseStatusLabel(application.license_status)),
          row('応募日時', new Date(application.created_at).toLocaleString('ja-JP')),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: '管理画面で確認',
              uri: `${process.env.FRONTEND_URL}/admin/applications/${application.id}`,
            },
            color: '#1DB446',
          },
        ],
      },
    },
  };

  await client.pushMessage({ to: STAFF_LINE_ID, messages: [message] });
}

async function sendApplicationConfirmation(lineUserId, application) {
  const message = {
    type: 'flex',
    altText: '応募を受け付けました',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '応募受付完了', weight: 'bold', color: '#ffffff' },
        ],
        backgroundColor: '#1DB446',
        paddingAll: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `${application.applicant_name}さんの応募を受け付けました。\n担当者より順次ご連絡いたします。`,
            wrap: true,
          },
          { type: 'separator', margin: 'md' },
          row('求人', application.job_title),
          row('企業', application.company_name),
        ],
      },
    },
  };

  await client.pushMessage({ to: lineUserId, messages: [message] });
}

function row(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#888888', flex: 2 },
      { type: 'text', text: value || '-', size: 'sm', flex: 3, wrap: true },
    ],
  };
}

function licenseStatusLabel(status) {
  const map = { holding: '取得済み', in_training: '教習中', planned: '取得予定' };
  return map[status] || status;
}

module.exports = { notifyStaff, sendApplicationConfirmation };
