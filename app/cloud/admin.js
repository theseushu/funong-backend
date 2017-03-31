import _find from 'lodash/find';
import AV from 'leanengine';
import { statusValues, certTypes, badges } from '../appConstants';

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', async (request, response) => {
  await new Promise((resolve) => setTimeout(() => {
    response.success({ hello: ' world'});
  }, 1000));
});

// users&roles
AV.Cloud.define('fetchUserRoles', function(request, response) {
  const { currentUser } = request;
  var targetUser = AV.Object.createWithoutData('_User', currentUser.id);
  var query = new AV.Query('_Role');
  query.equalTo('users', targetUser);
  query.find().then((roles) => {
    response.success(roles);
  }).catch((err) => {
    console.error(err);
    response.error(err);
  })
});

AV.Cloud.define('setUserToRole', (request, response) => {
  const { currentUser, params } = request;
  const { user, role } = params;
  const avRole = AV.Object.createWithoutData('_Role', role.objectId);
  avRole.relation('users').add(AV.Object.createWithoutData('_User', user.user.objectId))
  avRole.save(null, { useMasterKey: true }).then(() => {
    const avProfile = AV.Object.createWithoutData('Profile', user.objectId);
    avProfile.addUnique('roles', role.name);
    avProfile.save(null, { useMasterKey: true }).then(() => {
      response.success();
    }).catch((err) => {
      response.error(err);
    });
  }).catch((err) => {
    response.error(err);
  })
});

AV.Cloud.define('setUserToRole', (request, response) => {
  const { currentUser, params } = request;
  const { user, role } = params;
  const avRole = AV.Object.createWithoutData('_Role', role.objectId);
  avRole.relation('users').add(AV.Object.createWithoutData('_User', user.user.objectId))
  avRole.save(null, { useMasterKey: true }).then(() => {
    const avProfile = AV.Object.createWithoutData('Profile', user.objectId);
    avProfile.addUnique('roles', role.name);
    avProfile.save(null, { useMasterKey: true }).then(() => {
      response.success();
    }).catch((err) => {
      response.error(err);
    });
  }).catch((err) => {
    response.error(err);
  })
});

AV.Cloud.define('removeUserFromRole', (request, response) => {
  const { currentUser, params } = request;
  const { user, role } = params;
  const avRole = AV.Object.createWithoutData('_Role', role.objectId);
  avRole.relation('users').remove(AV.Object.createWithoutData('_User', user.user.objectId))
  avRole.save(null, { useMasterKey: true }).then(() => {
    const avProfile = AV.Object.createWithoutData('Profile', user.objectId);
    avProfile.remove('roles', role.name);
    avProfile.save(null, { useMasterKey: true }).then(() => {
      response.success();
    }).catch((err) => {
      response.error(err);
    });
  }).catch((err) => {
    response.error(err);
  })
});

// certs
AV.Cloud.define('searchCerts', (request, response) => {
  const { currentUser, params } = request;
  const { status, skip, limit } = params;

  const query = new AV.Query('Cert')
    .include(['images', 'owner', 'owner.avatar'])
    .ascending('status');
  if (Array.isArray(status)) {
    query.containedIn('status', status);
  } else if (status) {
    query.equalTo('status', status);
  }
  if (limit) {
    query.skip(skip || 0).limit(limit);
  }
  query.find({ useMasterKey: true })
    .then((certs) => {
      response.success(certs);
    }).catch((err) => {
    response.error(err);
  });
});
// certs
AV.Cloud.define('certs.changeStatus', (request, response) => {
  const { currentUser, params: { objectId, status } } = request;
  AV.Query.doCloudQuery('update Cert set status=? where objectId=?', [status, objectId], {
    useMasterKey: true,
  }).then(() => {
    response.success();
  }).catch((err) => {
    response.error(err);
  });
});

// certs
AV.Cloud.define('certs.verify', (request, response) => {
  const { currentUser, params: { objectId } } = request;
  const cert = AV.Object.createWithoutData('Cert', objectId);
  cert.fetch(null, { useMasterKey: true }).then(cert => {
    cert.set('status', statusValues.verified.value);
    cert.save(null, { useMasterKey: true, fetchWhenSave: true }).then(cert => {
      const owner = cert.get('owner');
      let badge;
      switch (cert.get('type')) {
        case certTypes.personal.value:
          badge = badges.idVerified.value;
          break;
        case certTypes.company.value:
          badge = badges.companyVerified.value;
          break;
        case certTypes.expert.value:
          badge = badges.expertVerified.value;
          break;
        default:
      }
      if (badge) {
        owner.addUnique('badges', badge);
        owner.save(null, {
          useMasterKey: true,
        }).then(() => {
          response.success();
        }).catch((err) => {
          response.error(err);
        });
      } else {
        response.success();
      }
    }).catch((err) => {
      response.error(err);
    })
  }).catch((err) => {
    response.error(err);
  })
});

// certs
AV.Cloud.define('certs.reject', (request, response) => {
  const { currentUser, params: { objectId } } = request;
  const cert = AV.Object.createWithoutData('Cert', objectId);
  cert.fetch(null, { useMasterKey: true }).then(cert => {
    cert.set('status', statusValues.rejected.value);
    cert.save(null, { useMasterKey: true, fetchWhenSave: true }).then(cert => {
      const owner = cert.get('owner');
      let badge;
      switch (cert.get('type')) {
        case certTypes.personal.value:
          badge = badges.idVerified.value;
          break;
        case certTypes.company.value:
          badge = badges.companyVerified.value;
          break;
        case certTypes.expert.value:
          badge = badges.expertVerified.value;
          break;
        default:
      }
      if (badge) {
        owner.remove('badges', badge);
        owner.save(null, {
          useMasterKey: true,
        }).then(() => {
          response.success();
        }).catch((err) => {
          response.error(err);
        });
      } else {
        response.success();
      }
    }).catch((err) => {
      response.error(err);
    })
  }).catch((err) => {
    response.error(err);
  })
});