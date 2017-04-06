// todo delete with ./chat.js
import AV from 'leanengine';
import { createUser } from './chat';

const userToResult = (user) => {
  const sessionToken = user.getSessionToken();
  const objectId = user.get('objectId');
  const mobilePhoneNumber = user.get('mobilePhoneNumber');
  return { sessionToken, objectId, mobilePhoneNumber };
}

AV.Cloud.define('signupOrLoginWithMobilePhone', async (request, response) => {
  try {
    const { phone, smsCode, attributes } = request.params;
    console.log(phone);
    console.log(attributes)
    const user = await AV.User.signUpOrlogInWithMobilePhone(phone, smsCode, attributes);
    response.success(userToResult(user));
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('loginWithPassword', async (request, response) => {
  try {
    const { phone, password } = request.params;
    console.log(phone);
    console.log(password)
    const user = await AV.User.logIn(phone, password);
    response.success(userToResult(user));
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});