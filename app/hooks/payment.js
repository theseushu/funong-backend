export default (app) => {
  app.get('/test', (req, res) => {
    res.send('hello world');
  });
};
