import AV from 'leanengine';

const createQuery = ({ sort, page, pageSize, category, species, provinces, status, owner }) => {
  let query = new AV.Query('Inquiry')
    .include(['category', 'species', 'owner', 'owner.avatar']);
  if (category) {
    query.equalTo('category', AV.Object.createWithoutData('Category', category.objectId));
  }
  if (species) {
    query.containedIn('species', species.map((s) => AV.Object.createWithoutData('Species', s.objectId)));
  }
  if (provinces && provinces.length > 0) {
    query.containedIn('address.province', provinces);
  }
  if (status && status.length > 0) {
    query.containedIn('status', status);
  }
  if (owner) {
    query.equalTo('owner', AV.Object.createWithoutData('_User', owner));
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

AV.Cloud.define('pageInquiries', async (request, response) => {
  try {
    const { sessionToken, params } = request;
    const { category, species, provinces, status, owner, sort, page = 1, pageSize = 20 } = params;
    const query = createQuery({ category, species, provinces, status, owner, sort, page, pageSize });
    const countQuery = createQuery({ category, species, provinces, status, owner });
    const [count, inquiries] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);
    const result = {
      total: count,
      totalPages: Math.ceil(count / pageSize),
      page,
      pageSize,
      first: page === 1,
      last: count <= page * pageSize,
      results: inquiries,
    }
    response.success(result);
  } catch (err) {
    console.error(err);
    response.error(err);
  }
});
