import sign from 'crypto';
import uuid from 'node-uuid';
import AV from 'leanengine';
import { calculateOrder } from 'funong-common/lib/utils/orderUtils';
import { statusValues } from 'funong-common/lib/appConstants';
import orderToJSON from 'funong-common/lib/converters/order';
const BEECLUOD_APPID = '5cf8154e-b7e6-4443-a421-f922ca52a0fb';
const BEECLOUD_SECRET = '81c9fba9-fe1f-49ee-a4ec-8efe8dc5e4d0';

class Order extends AV.Object {}
AV.Object.register(Order);

AV.Cloud.define('createOrders', async (request, response) => {
  try {
    const { currentUser, sessionToken, params } = request;
    const { orders } = params;
    const ordersToSave = orders.map((originOrder) => {
      const order = calculateOrder(originOrder, { objectId: currentUser.id });

      const { type, items, address, user, shop, agent, fees, message, services, amount, can, expireAt } = order;
      const avOrder = new Order();
      const acl = new AV.ACL();
      acl.setReadAccess(currentUser, true);
      acl.setWriteAccess(currentUser, true);
      avOrder.set('type', type);
      avOrder.set('items', items);
      avOrder.set('owner', AV.Object.createWithoutData('_User', currentUser.id));
      avOrder.set('address', address);
      if (user) {
        avOrder.set('user', AV.Object.createWithoutData('_User', user.objectId));
        acl.setReadAccess(user.objectId, true);
        acl.setWriteAccess(user.objectId, true);
      }
      if (shop) {
        avOrder.set('shop', AV.Object.createWithoutData('Shop', shop.objectId));
        acl.setReadAccess(shop.owner.objectId, true);
        acl.setWriteAccess(shop.owner.objectId, true);
      }
      if (agent) {
        avOrder.set('agent', AV.Object.createWithoutData('Shop', agent.objectId));
      }
      avOrder.set('fees', fees);
      avOrder.set('message', message);
      avOrder.set('services', services);
      avOrder.set('amount', amount);
      if (expireAt) {
        avOrder.set('expireAt', new Date(expireAt));
      }

      avOrder.set('status', can.commit.to);
      avOrder.setACL(acl);
      return avOrder;
    });
    const savedOrders = await AV.Object.saveAll(ordersToSave, {
      fetchWhenSave: true,
      sessionToken,
    });
    response.success(savedOrders);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('commitOrder', async (request, response) => {
  try {
    const { currentUser, sessionToken, params } = request;
    if (!params.order) {
      throw new Error('No order found in request');
    }
    const order = calculateOrder(params.order, { objectId: currentUser.id });
    const { can } = order;
    const avOrder = AV.Object.createWithoutData('Order', order.objectId);

    if (!order.can.commit || !order.can.commit.available || !order.can.commit.to) {
      throw new Error('The order cannot be committed');
    }
    const attrs = {};
    if (can.requirements) {
      attrs.message = order.message;
      attrs.services = order.services;
    }
    if (can.service || can.delivery || can.discount) {
      attrs.fees = order.fees;
      attrs.amount = order.amount;
    }
    attrs.status = order.can.commit.to;
    await avOrder.save(attrs, { sessionToken });
    const result = await avOrder.fetch({
      include: [
        'shop', 'shop.thumbnail',
        'owner', 'owner.avatar',
        'user', 'user.avatar',
        'agent', 'agent.avatar',
      ],
    }, { sessionToken });
    response.success(result);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('generateBeecloudBill', async (request, response) => {
  try {
    const { sessionToken, currentUser, params } = request;
    // const orderId = params.objectId;
    // if (!orderId || !currentUser) {
    //   throw new Error('');
    // }
    // const avOrder = await AV.Object.createWithoutData('Order', orderId).fetch(null, { sessionToken });
    // const order = calculateOrder(orderToJSON(avOrder), { objectId: currentUser.id });
    // if (order.owner.objectId !== currentUser.id || order.status !== statusValues.billed.value) {
    //   throw new Error('');
    // }
    // const calculated = calculateOrder(orderToJSON(avOrder), { objectId: currentUser.id });
    // const amount = calculated.amount.toString();
    // const title = '1111';
    //
    // const outTradeNo = uuid.v4().replace(/-/g, '');
    //
    // const data = BEECLUOD_APPID + title + amount + outTradeNo + BEECLOUD_SECRET;
    // console.log(data);
    // const signStr = sign.createHash('md5').update(data, 'utf8').digest('hex');
    //
    // console.log(JSON.stringify({
    //   title, amount, outTradeNo, signStr,
    // }));
    const appid = BEECLUOD_APPID;
    const secret = BEECLOUD_SECRET;
    const title = '中文 node.js water';
    const amount = '1';

    let outTradeNo = uuid.v4();
    outTradeNo = outTradeNo.replace(/-/g, '');

    const data = appid + title + amount + outTradeNo + secret;
    const signStr = sign.createHash('md5').update(data, 'utf8').digest('hex');
    response.success({
      title,
      amount,
      outTradeNo,
      sign: signStr,
    });
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});
