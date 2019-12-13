const _isEqual = require("lodash.isequal")

const { FigqlParser } = require(".")

const schema = `
type Query {
  user(id: String!): User!
}
enum FriendOrderBy {
  LAST_UPDATED
}
type User {
  id: String!
  name: String!
  friends(orderBy: FriendOrderBy): [User!]!
}`

const figql = new FigqlParser(schema)

const ret = figql.parseConfig({
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

const expected = {
  query: `query($_0:String!,$_1:FriendOrderBy) {
  user(id:$_0) {
    id
    name
    friends(orderBy:$_1) {
      id
    }
  }
}`,
  variables: {
    _0: "deadbeef",
    _1: "LAST_UPDATED",
  },
}

if (!_isEqual(ret, expected)) {
  console.log("got", ret)
  console.log("expected", expected)
  throw new Error("basic test failed")
}
