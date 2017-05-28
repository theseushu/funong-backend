import AV from 'leanengine';
import { statusValues } from 'funong-common/lib/appConstants';
// import Bill from '../cloud/payment';

/* {
  "id": "evt_ugB6x3K43D16wXCcqbplWAJo",
  "created": 1427555101,
  "livemode": true,
  "type": "charge.succeeded",
  "data": {
  "object": {
    "id": "ch_Xsr7u35O3m1Gw4ed2ODmi4Lw",
      "object": "charge",
      "created": 1427555076,
      "livemode": true,
      "paid": true,
      "refunded": false,
      "app": "app_1Gqj58ynP0mHeX1q",
      "channel": "upacp",
      "order_no": "123456789",
      "client_ip": "127.0.0.1",
      "amount": 100,
      "amount_settle": 100,
      "currency": "cny",
      "subject": "Your Subject",
      "body": "Your Body",
      "extra": {},
    "time_paid": 1427555101,
      "time_expire": 1427641476,
      "time_settle": null,
      "transaction_no": "1224524301201505066067849274",
      "refunds": {
      "object": "list",
        "url": "/v1/charges/ch_L8qn10mLmr1GS8e5OODmHaL4/refunds",
        "has_more": false,
        "data": []
    },
    "amount_refunded": 0,
      "failure_code": null,
      "failure_msg": null,
      "metadata": {},
    "credential": {},
    "description": null
  }
},
  "object": "event",
  "pending_webhooks": 0,
  "request": "iar_qH4y1KbTy5eLGm1uHSTS00s"
}*/
export default (app) => {
  app.post('/hooks/chargeSucceed', async (req, res) => {
    try {
      const event = req.body;
      const billId = event.data.order_no;
      const bill = await AV.Object.createWithoutData('Bill', billId).fetch({
        include: ['orders'],
      }, {
        useMasterKey: true,
      });
      const avOrders = bill.get('orders');
      avOrders.forEach((avOrder) => {
        avOrder.set('status', statusValues.payed.value);
      });
      await AV.Object.saveAll(avOrders, {
        useMasterKey: true,
      });
      console.log(avOrders)
      res.status(200).send('ok');
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  });
  // app.get('/hooks/chargeSucceed', async (req, res) => {
  //   try {
  //     console.log(req.query)
  //     const billId = req.query.id;
  //     console.log(billId)
  //     const bill = await AV.Object.createWithoutData('Bill', billId).fetch({
  //       include: ['orders'],
  //     }, {
  //       useMasterKey: true,
  //     });
  //     console.log(bill)
  //     const avOrders = bill.get('orders');
  //     avOrders.forEach((avOrder) => {
  //       avOrder.set('status', statusValues.payed.value);
  //     });
  //     await AV.Object.saveAll(avOrders, {
  //       useMasterKey: true,
  //     });
  //     console.log(avOrders)
  //     res.status(200).send('ok');
  //   } catch (err) {
  //     console.log(err);
  //     res.status(500).send(err);
  //   }
  // });
};
