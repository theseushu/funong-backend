import AV from 'leanengine';

const createQuery = ({ sort, page, pageSize, category, species, keyword, provinces, status, owner }) => {
  let query = new AV.Query('Inquiry')
    .include(['category', 'species', 'owner', 'owner.avatar']);
  if (category) {
    query.equalTo('category', AV.Object.createWithoutData('Category', category));
  }
  if (species) {
    query.equalTo('species', AV.Object.createWithoutData('Species', species));
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
  if (keyword) {
    const keywordQuery = AV.Query.or(
      new AV.Query('Inquiry').contains('name', keyword),
      new AV.Query('Inquiry').contains('desc', keyword),
    );
    query = AV.Query.and(query, keywordQuery);
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
    const { category, species, keyword, provinces, status, owner, sort, page = 1, pageSize = 20 } = params;
    const query = createQuery({ category, species, keyword, provinces, status, owner, sort, page, pageSize });
    const countQuery = createQuery({ category, species, keyword, provinces, status, owner });
    const [count, inquiries] = await Promise.all([countQuery.count({ sessionToken }), query.find({ sessionToken })]);
    const result = {
      total: count,
      totalPages: Math.ceil(count / page),
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
