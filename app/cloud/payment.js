import AV from 'leanengine';
import _reduce from 'lodash/reduce';
import _find from 'lodash/find';
import { statusValues } from 'funong-common/lib/appConstants';
import { orderToJSON } from './converters';

const APP_ID = 'app_aLeLm5r9a1CG4uvH';
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQCjeV5Bf6CKAh0U05ijLsw4GclkX7R5I9uOyMCs24/9RJ2339VG
7vWzNmrJJ4D18IWTo40qPRKZTjIK0BPY3CAXjP5MjhMTtPTzIa9XAxD3dnXUjc3p
lkph1U+t5Wylrf0gMZ6qI/n9xFQNdm/EdkRoV6VUECDdfxfivOgP6voZhQIDAQAB
AoGANHoLhd8ge+z9xOfAAfJN4Fx2x9/pIVIfcxCCuXqqGFVkg9g4sNKY0PTRBs3F
mi2h06kW8c41ID131vzAwka3jhQ/FFmJSM3k0sC1NQ5lV4vQ6msB/micMjTwhDCl
tNlQQGeRzuSc++KNVS2PNOxVZ8RGFkN9LsoAE1aE6pYp2EECQQDZonlpillvccOy
WB9DNyJYLTQeXKNj8xZInCRgSKwTCs/CC+x3buMMxxxfgQ9BboGZTuIXyBrEJ7Gi
YP8tafOdAkEAwEq1a3sLz2jxNg1Vcf4FrkFY3IP42LmhcfI9WxAx+0I3OZdiNfN6
tRofnGQzWac/Cq8yBJISGlQUHHJ2gRrdCQJBAJqmM7RllUv2AWP37q8qvIMADCsP
FSPvFwSdv9OTkIMviZaQNoZgC4OG8YiEAz0xs3Indc4EadC9jCKg3nN8+JkCQA4Y
a9wJFQCLLMNNjungOQJg/+aKNf+M++yiWSUHtuI4JFwwYJ6bzm7gD1kjbzAvNkvO
M9hp7LHJYAAF0/H6yiECQQDKjBUz3GerX+53RmKKgQKWa0R+SPxyyute5Yct+U6l
9W3SE+AkxaK+h1w1vD5p/XCZ8f4Vrj6SnXp8El07LC4x
-----END RSA PRIVATE KEY-----`;
const pingpp = require('pingpp')('sk_test_KW5e58uX1uHGubzvHGqb1WTK');
pingpp.setPrivateKey(PRIVATE_KEY);

export class Bill extends AV.Object {}
AV.Object.register(Bill);

AV.Cloud.define('generateBill', async (request, response) => {
  const { params, sessionToken, currentUser } = request;
  const { orderIds, channel, extra } = params;
  try {
    const avOrders = await new AV.Query('Order').containedIn('objectId', orderIds).find({ sessionToken });
    const orders = avOrders.map(orderToJSON);
    // validate
    if (orders.length === 0 || !!_find(orders, (order) => (order.status !== statusValues.billed.value || !order.owner.objectId === currentUser.id))) {
      throw new Error('There are orders cannot be payed or not belong to current user.');
    }
    // create bill
    const bill = new Bill();
    bill.set('orders', orders.map((order) => AV.Object.createWithoutData('Order', order.objectId)));
    await bill.save(null, { sessionToken });

    const amount = _reduce(orders, (result, order) => result + order.amount, 0) * 100;

    const charge = await new Promise((resolve, reject) => {
      pingpp.charges.create({
        order_no: bill.id,
        app: { id: APP_ID },
        channel,
        amount,
        client_ip: request.ip || '127.0.0.1',
        currency: 'cny',
        subject: '富农商城担保交易',
        body: `共需支付￥${amount / 100}`,
        extra: channel === 'wx_pub_qr' ? {
          ...extra,
          product_id: bill.id,
        } : extra,
      }, (err, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(err);
        }
      });
    });
    await bill.save({ charge }, { sessionToken });
    response.success(charge);
  } catch (err) {
    // console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('billSucceed', async (request, response) => {
  try {
    console.log(request.body);
  } catch (err) {
    // console.error(err);
    response.error(err);
  }
});
