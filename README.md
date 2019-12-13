# (con)figql

*WARNING*: This is just a very rough idea. Please don't actually use in its current state.

A different way to write GraphQL queries.

Normally, you do something like:

```
graqphlClient.execute({
  query: `query($id: String!, $orderBy: FriendOrderBy) {
    user(id: $id) {
      id
      name
      friends(orderBy: $orderBy) {
        id
      }
    }
  }`,
  variables: {
    id: "deadbeef",
    orderBy: "LAST_UPDATED",
  },
})
```

With figql, you combine the query and variables with a little magic (and the fact the schema is known):

```
const { FigqlParser } = require("figql")

const schema = fetchSchema() // TODO if bundled http client could get from graphql endpoint

const figql = new FigqlParser(schema)

graphqlClient.execute(figql.parseConfig({
  user: {
    $id: "deadbeef",
    id: 1,
    name: 1,
    friends: {
      $orderBy: "LAST_UPDATED",
      id: 1,
    },
  },
})
```

I think this is interesting... and can be augmented in many ways... so wanted to share.

Please tell me if it's stupid (or if it's already been done, but couldn't find it.)
