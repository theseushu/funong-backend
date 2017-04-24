import AV from 'leanengine';

const createQuery = ({ inquiry, owner, sort, page, pageSize }) => {
  const query = new AV.Query('Bid')
    .include(['product', 'product.thumbnail', 'owner', 'owner.avatar', 'inquiry', 'inquiry.owner', 'inquiry.category', 'inquiry.species']);
  if (inquiry) {
    query.equalTo('inquiry', AV.Object.createWithoutData('Inquiry', inquiry.objectId));
  }
  if (owner) {
    query.equalTo('owner', AV.Object.createWithoutData('_User', owner.objectId));
  }
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

AV.Cloud.define('pageBids', async (request, response) => {
  try {
    const { currentUser, sessionToken, params } = request;
    const { inquiry, mine, sort, page = 1, pageSize = 10 } = params;
    // if user is not the owner of the inquiry, and not querying his own bids
    // return only first 5 records, ignoring page, pageSize.
    if (inquiry && (!mine) && (!currentUser || inquiry.owner.objectId !== currentUser.id)) {
      const query = createQuery({ inquiry, owner: null, sort, page: 1, pageSize: 5 });
      const countQuery = createQuery({ inquiry, owner: null, sort });
      const [count, bids] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);
      response.success({
        total: count,
        totalPages: 1,
        page: 1,
        pageSize: 5,
        first: true,
        last: true,
        results: bids,
      });
    } else {
      const query = createQuery({ inquiry, owner: mine ? { objectId: currentUser.id } : null, sort, page, pageSize });
      const countQuery = createQuery({ inquiry, owner: mine ? { objectId: currentUser.id } : null, sort });
      const [count, bids] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);
      const result = {
        total: count,
        totalPages: Math.ceil(count / pageSize),
        page,
        pageSize,
        first: page === 1,
        last: count <= page * pageSize,
        results: bids,
      };
      response.success(result);
    }
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});
