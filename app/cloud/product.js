import _union from 'lodash/union';
import _isUndefined from 'lodash/isUndefined';
import _map from 'lodash/map';
import AV from 'leanengine';
import { statusValues } from 'funong-common/lib/appConstants';
import { generateKeywords } from 'funong-common/lib/utils/publishUtils';
import { products as productSchemas } from './shemas';

AV.Cloud.define('createProduct', async (request, response) => {
  try {
    const { sessionToken, currentUser, params: { type, ...attrs } } = request;
    const schema = productSchemas[type];
    const { table, attributes } = schema;
    const product = new schema.Class();
    if (attrs.status !== statusValues.unverified.value) { // new product can be only unavailable or unverified (未上架/已上架)
      attrs.status = statusValues.unavailable.value;
    }
    attrs.owner = { objectId: currentUser.id };
    _map(attrs, (value, key) => {
      if (!_isUndefined(value)) {
        const attrSchema = attributes[key];
        if (!attrSchema || !attrSchema.create) {
          throw new Error(`Unsupported attr(${key}) in ${table} creating`);
        }
        attrSchema.create(product, value);
      }
    });
    product.set('keywords', generateKeywords(attrs, type));
    const savedProduct = await product.save(null, {
      fetchWhenSave: true,
      sessionToken,
    });
    response.success(savedProduct);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

AV.Cloud.define('updateProduct', async (request, response) => {
  try {
    const { sessionToken, params: { type, objectId, ...attrs } } = request;
    if (!objectId) {
      throw new Error('objectId is empty');
    }
    const schema = productSchemas[type];
    const { table, attributes } = schema;
    const toSave = AV.Object.createWithoutData(table, objectId);
    if (attrs.status !== statusValues.unverified.value) { // new product can be only unavailable or unverified (未上架/已上架)
      attrs.status = statusValues.unavailable.value;
    }
    _map(attrs, (value, key) => {
      if (!_isUndefined(value)) {
        const attrSchema = attributes[key];
        if (!attrSchema || !attrSchema.update) {
          throw new Error(`Unsupported attr(${key}) in ${table} updating`);
        }
        attrSchema.update(toSave, value);
      }
    });
    toSave.set('keywords', generateKeywords(attrs, type));
    const savedProduct = await toSave.save(null, {
      fetchWhenSave: true,
      sessionToken,
    });
    response.success(savedProduct);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});

const createQuery = (schema, { sort, page, pageSize, ...params }) => {
  const { table, attributes } = schema;
  const query = new AV.Query(table)
    .include(_union(..._map(attributes, (attr) => attr.include)));
  _map(params, (value, key) => {
    if (!_isUndefined(value)) {
      const attrSchema = attributes[key];
      if (!attrSchema || !attrSchema.search) {
        throw new Error(`Unsupported attr(${key}) in ${table} searching`);
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

AV.Cloud.define('pageProducts', async (request, response) => {
  try {
    const { sessionToken, currentUser, params } = request;
    const { type, sort, page, pageSize, owner, ...otherParams } = params;
    const schema = productSchemas[type];
    if (!schema) {
      throw new Error(`Unknown type ${type}`);
    }
    let status = [];
    if (owner && owner.objectId === currentUser.id) {
      if (params.status) {
        status = params.status.filter((value) => value !== statusValues.unverified.value && value !== statusValues.verified.value && value !== statusValues.rejected.value);
        if (params.status.length !== status.length) {
          console.warn(`You've set illegal status in query. available values are [${statusValues.unverified.value}, ${statusValues.verified.value}, ${statusValues.rejected.value}]`);
        }
      } else {
        status = [statusValues.unverified.value, statusValues.verified.value, statusValues.rejected.value];
      }
    } else {
      if (params.status) {
        console.warn('You shall not set status as query param when not querying products of yourself');
      }
      status = [statusValues.unverified.value, statusValues.verified.value];
    }
    const query = createQuery(schema, { sort, page, pageSize, ...otherParams, owner, status });
    const countQuery = createQuery(schema, { ...otherParams, owner, status });
    const [count, products] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);

    const result = {
      total: count,
      totalPages: Math.ceil(count / pageSize),
      page,
      pageSize,
      first: page === 1,
      last: count <= page * pageSize,
      results: products,
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
    const schema = productSchemas[type];
    if (!schema) {
      throw new Error(`Unknown type ${type}`);
    }
    const { table } = schema;
    const product = await AV.Object.createWithoutData(table, objectId).fetch({ sessionToken });
    const status = product.get('status');
    if (statusCheck) {
      statusCheck(status, newStatus);
    }
    product.set('status', newStatus);
    await product.save({ sessionToken });
    response.success({ updatedAt: product.get('updatedAt').getTime(), status: newStatus });
  } catch (err) {
    console.error(err);
    response.error(err);
  }
};

AV.Cloud.define('enableProduct', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.unverified.value,
  (status) => {
    if (status !== statusValues.unavailable.value) {
      throw new Error(`You can only enable unavailable products. current status: ${status}`);
    }
  }
));

AV.Cloud.define('disableProduct', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.unavailable.value,
  (status) => {
    if (status !== statusValues.unverified.value && status !== statusValues.verified.value) {
      throw new Error(`You can only disable unverified or verified products. current status: ${status}`);
    }
  }
));

AV.Cloud.define('removeProduct', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.removed.value,
));

AV.Cloud.define('verifyProduct', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.verified.value,
  (status) => {
    if (status !== statusValues.verified.value) {
      throw new Error(`You can only verify unverified products. current status: ${status}`);
    }
  }
));

AV.Cloud.define('rejectProduct', async (request, response) => await changeStatus(
  request,
  response,
  statusValues.verified.value,
  (status) => {
    if (status !== statusValues.unverified.value || status !== statusValues.verified.value) {
      throw new Error(`You can only reject unverified or verified products. current status: ${status}`);
    }
  }
));
