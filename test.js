const AV = require('leancloud-storage');
const APP_ID = 'ouy08OrFpGAJNxS1T69ceUH7-gzGzoHsz';
const APP_KEY = 'JNUXol0O66lg5H24kxcmcnOt';
const sessionToken = 'ykx7up7k3rs4ufx39xx7wpkeu';

AV.init({
  appId: APP_ID,
  appKey: APP_KEY,
});

const test = function() {
  AV.Cloud.rpc('hello', null, { sessionToken }).then((result) => {
    console.log(result)
  }).catch(e => console.log(e));
}

test();