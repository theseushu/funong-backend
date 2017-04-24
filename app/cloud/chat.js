import request from 'superagent';
const debug = require('debug')('funongbackend:chat');
const ORG_NAME = '1101170401115025';
const APP_NAME = 'funong';
const client_id = 'YXA6OVFXwBbqEee7ZUdb6zKYbg';
const client_secret = 'YXA6vDaVqrdP5V1zlN0w0VmN80vXKiI';

const token = {};
const init = async () => {
  if (token.access_token) {
    return;
  }
  const response = await request
      .post(`http://a1.easemob.com/${ORG_NAME}/${APP_NAME}/token`)
      .set('Content-Type', 'application/json')
      .send({ grant_type: 'client_credentials', client_id, client_secret });
  if (response.status === 200) {
    const { access_token, expires_in, application } = response.body;
    token.access_token = access_token;
    token.expires_in = expires_in;
    token.application = application;
  } else {
    throw new Error('Cannot fetch token from easemob');
  }
};

export const createUser = async ({ username, password }) => {
  await init();
  try {
    await request
        .get(`http://a1.easemob.com/${ORG_NAME}/${APP_NAME}/users/${username}`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token.access_token}`)
        .send({ username, password });
  } catch (err) {
    if (err.status === 404) {
      try {
        await request
            .post(`http://a1.easemob.com/${ORG_NAME}/${APP_NAME}/users`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token.access_token}`)
            .send({ username, password });
        debug(`Chat account created for user: ${username}`);
      } catch (err) {
        debug(`Faild creating Chat account for user: ${username}`);
        debug(err);
      }
    }
  }
};
