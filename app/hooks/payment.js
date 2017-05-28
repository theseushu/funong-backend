export default (app) => {
  app.get('/test', (req, res) => {
    res.send('hello world');
  });
  app.post('/hooks/chargeSucceed', (req, res) => {
    res.send('hello world');
  });
};
