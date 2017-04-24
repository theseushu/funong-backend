import _union from 'lodash/union';
import _isUndefined from 'lodash/isUndefined';
import _map from 'lodash/map';
import AV from 'leanengine';
import { generateKeywords } from 'funong-common/lib/utils/publishUtils';
import { statusValues } from 'funong-common/lib/appConstants';
import { publishes as publishesSchemas } from './shemas';

AV.Cloud.define('createPublish', async (request, response) => {
  try {
    const { sessionToken, currentUser, params: { type, ...attrs } } = request;
    const schema = publishesSchemas[type];
    const { table, attributes } = schema;
    const toSave = new schema.Class();
    if (attrs.status !== statusValues.unverified.value) { // new publish can be only unavailable or unverified (未上架/已上架)
      attrs.status = statusValues.unavailable.value;
    }
    if (attributes.owner && attributes.owner.create) {
      attrs.owner = { objectId: currentUser.id };
    }
    _map(attrs, (value, attr) => {
      if (!_isUndefined(value)) {
        const attrSchema = attributes[attr];
        if (!attrSchema || !attrSchema.create) {
          throw new Error(`Unsupported attr(${attr}) in ${table} creating`);
        }
        attrSchema.create(toSave, value);
      }
    });
    toSave.set('keywords', generateKeywords(attrs, type));
    const saved = await toSave.save(null, {
      fetchWhenSave: true,
      sessionToken,
    });
    response.success(saved);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('updatePublish', async (request, response) => {
  try {
    const { sessionToken, params: { type, objectId, ...attrs } } = request;
    if (!objectId) {
      throw new Error('objectId is empty');
    }
    const schema = publishesSchemas[type];
    const { table, attributes } = schema;
    const toSave = AV.Object.createWithoutData(table, objectId);
    if (attrs.status !== statusValues.unverified.value) { // new publish can be only unavailable or unverified (未上架/已上架)
      attrs.status = statusValues.unavailable.value;
    }
    _map(attrs, (value, attr) => {
      if (!_isUndefined(value)) {
        const attrSchema = attributes[attr];
        if (!attrSchema || !attrSchema.update) {
          throw new Error(`Unsupported attr(${attr}) in ${table} updating`);
        }
        attrSchema.update(toSave, value);
      }
    });
    toSave.set('keywords', generateKeywords(attrs, type));
    const savedPublish = await toSave.save(null, {
      fetchWhenSave: true,
      sessionToken,
    });
    response.success(savedPublish);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

const createQuery = (schema, { sort, page, pageSize, ...params }) => {
  const { table, attributes } = schema;
  const query = new AV.Query(table)
    .include(_union(..._map(attributes, (attr) => attr.include)));
  _map(params, (value, type) => {
    if (!_isUndefined(value)) {
      const attrSchema = attributes[type];
      if (!attrSchema || !attrSchema.search) {
        throw new Error(`Unsupported attr(${type}) in ${table} searching`);
      }
      attrSchema.search(query, value);
    }
  });
  if (sort && sort.sort) {
    if (sort.order === 'asc') {
      query.addAscending(sort.sort);
    } else {
      query.addDescending(sort.sort);
    }
  }
  if (page && pageSize) {
    query
      .skip((page - 1) * pageSize)
      .limit(pageSize);
  }
  return query;
};

AV.Cloud.define('pagePublishes', async (request, response) => {
  try {
    const { sessionToken, currentUser, params } = request;
    const { type, sort, page, pageSize, owner, shop, ...otherParams } = params;
    const schema = publishesSchemas[type];
    if (!schema) {
      throw new Error(`Unknown type ${type}`);
    }
    let status = [];
    if ((owner && owner.objectId === currentUser.id) || (shop && shop.owner.objectId === currentUser.id)) {
      if (params.status) {
        status = params.status.filter((value) => value !== statusValues.unverified.value && value !== statusValues.verified.value && value !== statusValues.rejected.value);
        if (params.status.length !== status.length) {
          console.warn(`You've set illegal status in query. available values are [${statusValues.unverified.value}, ${statusValues.verified.value}, ${statusValues.rejected.value}]`);
        }
      } else {
        status = [statusValues.unavailable.value, statusValues.unverified.value, statusValues.verified.value, statusValues.rejected.value];
      }
    } else {
      if (params.status) {
        console.warn('You shall not set status as query param when not querying of yourself');
      }
      status = [statusValues.unverified.value, statusValues.verified.value];
    }
    const query = createQuery(schema, { sort, page, pageSize, ...otherParams, owner, shop, status });
    const countQuery = createQuery(schema, { ...otherParams, owner, shop, status });
    const [count, publishes] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);

    const result = {
      total: count,
      totalPages: Math.ceil(count / pageSize),
      page,
      pageSize,
      first: page === 1,
      last: count <= page * pageSize,
      results: publishes,
    };
    response.success(result);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

const changeStatus = async (request, response, newStatus, statusCheck) => {
  try {
    const { sessionToken, params } = request;
    const { objectId, type } = params;
    const schema = publishesSchemas[type];
    if (!schema) {
      throw new Error(`Unknown type ${type}`);
    }
    const { table } = schema;
    const publish = await AV.Object.createWithoutData(table, objectId).fetch({ sessionToken });
    const status = publish.get('status');
    if (statusCheck) {
      statusCheck(status, newStatus);
    }
    publish.set('status', newStatus);
    await publish.save({ sessionToken });
    response.success({ updatedAt: publish.get('updatedAt').getTime(), status: newStatus });
  } catch (err) {
    console.error(err);
    response.error(err);
  }
};

AV.Cloud.define('enablePublish', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.unverified.value,
  (status) => {
    if (status !== statusValues.unavailable.value) {
      throw new Error(`You can only enable unavailable publishs. current status: ${status}`);
    }
  }
));

AV.Cloud.define('disablePublish', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.unavailable.value,
  (status) => {
    if (status !== statusValues.unverified.value && status !== statusValues.verified.value) {
      throw new Error(`You can only disable unverified or verified publishs. current status: ${status}`);
    }
  }
));

AV.Cloud.define('removePublish', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.removed.value,
));

AV.Cloud.define('verifyPublish', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.verified.value,
  (status) => {
    if (status !== statusValues.verified.value) {
      throw new Error(`You can only verify unverified publishs. current status: ${status}`);
    }
  }
));

AV.Cloud.define('rejectPublish', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.verified.value,
  (status) => {
    if (status !== statusValues.unverified.value || status !== statusValues.verified.value) {
      throw new Error(`You can only reject unverified or verified publishs. current status: ${status}`);
    }
  }
));
